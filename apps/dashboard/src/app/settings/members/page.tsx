'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Users, UserMinus, Shield, ChevronDown, Loader2, AlertTriangle, CheckCircle, UserPlus, Mail, X, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/providers';
import { EmptyState } from '@/components/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { userAvatarEndpoint } from '@/lib/avatar';

interface Entitlement {
  planType: string;
  features: Record<string, boolean | string>;
  limits: { users?: number };
}

type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface TeamMember {
  id: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  invitedBy: { id: string; email: string; displayName: string | null } | null;
}

interface AlertState {
  type: 'success' | 'error';
  message: string;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

const ROLE_BADGE: Record<MemberRole, string> = {
  OWNER: 'bg-black text-white border border-[#444748]',
  ADMIN: 'bg-black text-[#e2e2e2] border border-[#333333]',
  MEMBER: 'bg-black text-neutral-400 border border-[#262626]',
  VIEWER: 'bg-black text-neutral-500 border border-[#262626]',
};

const ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(url, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data as T;
}

export default function MembersPage() {
  const { selectedOrgId, user, memberships } = useSession();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [rescinding, setRescinding] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const currentMembership = memberships.find((m) => m.organization.id === selectedOrgId);
  const isOwner = currentMembership?.role === 'OWNER';
  const isAdmin = currentMembership?.role === 'ADMIN' || isOwner;

  const { data: entitlement } = useQuery<Entitlement>({
    queryKey: ['members-entitlement', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/entitlement`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const userLimit = entitlement?.limits?.users ?? 1;
  // Only accepted members count against the hard seat limit.
  // Pending invitations are shown in the UI counter but don't block new invites.
  const activeMemberCount = members.length;
  const currentMemberCount = members.length + pendingInvitations.length; // display only
  const hasTeamAccess = entitlement?.features?.TEAM_COLLABORATION === true || userLimit > 1;
  const userLimitReached = activeMemberCount >= userLimit;

  const loadMembers = useCallback(async () => {
    if (!selectedOrgId) return;
    const sequence = ++loadSequence.current;
    const organizationId = selectedOrgId;
    setIsLoading(true);
    try {
      const [memberData, inviteData] = await Promise.all([
        requestJson<TeamMember[]>(`/api-gateway/organizations/${organizationId}/members`),
        requestJson<{ success: boolean; data: PendingInvitation[] }>(`/api-gateway/organizations/${organizationId}/invitations/pending`)
          .then((r) => r.data).catch(() => [] as PendingInvitation[]),
      ]);
      if (sequence !== loadSequence.current) return;
      setMembers(memberData);
      setPendingInvitations(inviteData);
    } catch (err: any) {
      if (sequence !== loadSequence.current) return;
      setAlert({ type: 'error', message: err.message || 'Failed to load members.' });
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    setMembers([]);
    setPendingInvitations([]);
    setAlert(null);
    void loadMembers();
    return () => { loadSequence.current += 1; };
  }, [loadMembers]);

  async function handleRoleChange(userId: string, newRole: MemberRole) {
    setChangingRole(userId);
    setAlert(null);
    try {
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      await loadMembers();
      setAlert({ type: 'success', message: `Role updated to ${ROLE_LABELS[newRole]}.` });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to update role.' });
    } finally {
      setChangingRole(null);
    }
  }

  async function handleRemove(userId: string) {
    setRemoving(userId);
    setConfirmRemove(null);
    setAlert(null);
    try {
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/members/${userId}`, { method: 'DELETE' });
      await loadMembers();
      setAlert({ type: 'success', message: 'Member removed.' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to remove member.' });
    } finally {
      setRemoving(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedOrgId) return;
    setInviting(true);
    setAlert(null);
    try {
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail('');
      setInviteRole('MEMBER');
      await loadMembers();
      setAlert({ type: 'success', message: `Invitation sent to ${inviteEmail.trim()}.` });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to send invitation.' });
    } finally {
      setInviting(false);
    }
  }

  async function handleRescind(invitationId: string) {
    setRescinding(invitationId);
    try {
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/invitations/${invitationId}`, { method: 'DELETE' });
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      setAlert({ type: 'success', message: 'Invitation rescinded.' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to rescind invitation.' });
    } finally {
      setRescinding(null);
    }
  }

  const owners = members.filter((m) => m.role === 'OWNER');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Team Members</h1>
        <p className="mt-1 text-sm text-neutral-400">Manage who has access to this organization and their roles.</p>
      </div>

      {/* Invite Member (owners/admins only) */}
      {isAdmin && hasTeamAccess && !userLimitReached && (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-5">
          <div className="flex items-center justify-between gap-2 mb-4 border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-white" />
              <h2 className="text-sm font-semibold text-white">Invite Member</h2>
            </div>
            <span className="text-xs font-mono text-[#8e9192]">
              {currentMemberCount} of {userLimit} member slot{userLimit > 1 ? 's' : ''} used
            </span>
          </div>
          <form onSubmit={(e) => void handleInvite(e)} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
              <input
                id="invite-email-input"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 rounded-md border border-[#262626] bg-black text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition font-mono text-xs"
              />
            </div>
            <Select
              value={inviteRole}
              onValueChange={(val) => setInviteRole(val as MemberRole)}
            >
              <SelectTrigger id="invite-role-select" className="w-[150px] font-mono text-xs bg-black border-[#262626]">
                <SelectValue placeholder="Select role...">
                  {ROLE_LABELS[inviteRole]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                  <SelectItem key={r} value={r} className="font-mono text-xs">
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              id="invite-submit-btn"
              type="submit"
              variant="primary"
              size="sm"
              disabled={inviting || !inviteEmail.trim()}
              loading={inviting}
            >
              {!inviting && <UserPlus className="h-4 w-4" />}
              Send Invite
            </Button>
          </form>
        </section>
      )}

      {/* Member Limit Reached Warning */}
      {isAdmin && hasTeamAccess && userLimitReached && (
        <div className="rounded-md border border-[#262626] bg-[#131313] p-4 text-xs font-mono text-[#8e9192] flex flex-wrap items-center justify-between gap-3">
          <span>
            Member limit reached ({currentMemberCount} of {userLimit} member slot{userLimit > 1 ? 's' : ''} used on your {entitlement?.planType ?? 'current'} plan).
          </span>
          <a
            href={`${process.env.NEXT_PUBLIC_MARKETING_URL || 'https://domain-name.com'}/pricing`}
            className="text-white border border-white px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider hover:bg-neutral-200 hover:text-black transition-colors shrink-0"
          >
            Upgrade Plan &rarr;
          </a>
        </div>
      )}

      {/* No Team Collaboration Feature */}
      {isAdmin && !hasTeamAccess && (
        <div className="rounded-md border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Team collaboration starts on plans with multiple member seats. Existing membership remains visible, but inviting teammates requires an upgrade.
        </div>
      )}

      {alert && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-mono',
            alert.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300' : 'border-red-900/60 bg-red-950/40 text-red-300',
          )}
        >
          <div className="flex items-center gap-3">
            {alert.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{alert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="text-[#8e9192] hover:text-white transition-colors text-xs font-mono uppercase tracking-wider shrink-0 cursor-pointer"
            aria-label="Dismiss alert"
          >
            [Cancel]
          </button>
        </div>
      )}

      {/* Members List */}
      <section className="rounded-md border border-[#262626] bg-[#131313]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold text-white">{members.length} Members</span>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
        </div>

        {members.length === 0 && !isLoading ? (
          <EmptyState
            variant="neutral"
            illustration="list"
            layout="compact"
            eyebrow="Team"
            title="No members found"
            description="Invite a teammate when you are ready to collaborate on this organization."
            className="m-4"
          />
        ) : (
          <ul className="divide-y divide-[#262626]">
            {members.map((member) => {
              const isCurrentUser = member.userId === user?.id;
              const isSoleOwner = member.role === 'OWNER' && owners.length === 1;
              const canModify = isOwner && !isCurrentUser && !isSoleOwner;

              return (
                <li key={member.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <Avatar
                    src={member.user.avatarUrl ?? userAvatarEndpoint(member.userId)}
                    name={member.user.displayName}
                    email={member.user.email}
                    size={36}
                    shape="circle"
                    className="shadow"
                  />

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">
                        {member.user.displayName || member.user.email.split('@')[0]}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black text-[#8e9192] border border-[#444748] font-mono font-medium">You</span>
                      )}
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider', ROLE_BADGE[member.role])}>
                        {ROLE_LABELS[member.role]}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">{member.user.email}</p>
                  </div>

                  {/* Actions */}
                  {canModify && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role dropdown */}
                      <div className="relative w-[110px]">
                        <Select
                          value={member.role}
                          onValueChange={(val) => void handleRoleChange(member.userId, val as MemberRole)}
                        >
                          <SelectTrigger
                            id={`role-select-${member.userId}`}
                            disabled={changingRole === member.userId}
                            className="py-1.5 px-2.5 text-xs font-normal"
                          >
                            <SelectValue placeholder="Role">
                              {ROLE_LABELS[member.role]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {changingRole === member.userId && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                          </div>
                        )}
                      </div>

                      {/* Remove */}
                      {confirmRemove === member.userId ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-red-400">Remove?</span>
                          <Button
                            id={`confirm-remove-${member.userId}`}
                            variant="danger"
                            size="xs"
                            onClick={() => void handleRemove(member.userId)}
                            disabled={removing === member.userId}
                          >
                            {removing === member.userId ? '...' : 'Yes'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setConfirmRemove(null)}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          id={`remove-member-${member.userId}`}
                          variant="icon"
                          size="icon"
                          onClick={() => setConfirmRemove(member.userId)}
                          tooltip="Remove member"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-800">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Pending Invitations ({pendingInvitations.length})</span>
          </div>
          <ul className="divide-y divide-neutral-800">
            {pendingInvitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Role: <span className="text-neutral-300">{ROLE_LABELS[inv.role]}</span>
                    {inv.expiresAt && ` · Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    id={`rescind-invite-${inv.id}`}
                    variant="danger"
                    size="xs"
                    onClick={() => void handleRescind(inv.id)}
                    disabled={rescinding === inv.id}
                    loading={rescinding === inv.id}
                    tooltip="Rescind invitation"
                  >
                    {rescinding !== inv.id && <X className="h-3 w-3" />}
                    Rescind
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isOwner && (
        <p className="text-xs text-neutral-500 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Only Owners can change roles or remove members. Contact your organization Owner to make changes.
        </p>
      )}
    </div>
  );
}
