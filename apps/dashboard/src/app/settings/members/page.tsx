'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Users, UserMinus, Shield, ChevronDown, Loader2, AlertTriangle, CheckCircle, UserPlus, Mail, X, Clock } from 'lucide-react';
import { useSession } from '@/components/providers';

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
  OWNER: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  ADMIN: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  MEMBER: 'bg-neutral-800 text-neutral-300 border border-neutral-700',
  VIEWER: 'bg-neutral-900 text-neutral-500 border border-neutral-800',
};

const ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
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

  const currentMembership = memberships.find((m) => m.organization.id === selectedOrgId);
  const isOwner = currentMembership?.role === 'OWNER';
  const isAdmin = currentMembership?.role === 'ADMIN' || isOwner;

  const loadMembers = useCallback(async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const [memberData, inviteData] = await Promise.all([
        requestJson<TeamMember[]>(`/api-gateway/organizations/${selectedOrgId}/members`),
        requestJson<{ success: boolean; data: PendingInvitation[] }>(`/api-gateway/organizations/${selectedOrgId}/invitations/pending`)
          .then((r) => r.data).catch(() => [] as PendingInvitation[]),
      ]);
      setMembers(memberData);
      setPendingInvitations(inviteData);
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to load members.' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

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
      {isAdmin && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Invite Member</h2>
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
                className="w-full pl-9 pr-3 py-2 rounded-md border border-neutral-700 bg-neutral-950 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <select
              id="invite-role-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              className="rounded-md border border-neutral-700 bg-neutral-950 text-sm text-neutral-200 px-3 py-2 focus:outline-none focus:border-indigo-500 transition"
            >
              {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              id="invite-submit-btn"
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition disabled:opacity-50 shrink-0"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Send Invite
            </button>
          </form>
        </section>
      )}

      {alert && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm',
            alert.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300' : 'border-red-900/60 bg-red-950/40 text-red-300',
          )}
        >
          {alert.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{alert.message}</span>
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">{members.length} Members</span>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
        </div>

        {members.length === 0 && !isLoading ? (
          <div className="py-12 text-center text-sm text-neutral-500">No members found.</div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {members.map((member) => {
              const initial = (member.user.displayName?.[0] || member.user.email[0]).toUpperCase();
              const isCurrentUser = member.userId === user?.id;
              const isSoleOwner = member.role === 'OWNER' && owners.length === 1;
              const canModify = isOwner && !isCurrentUser && !isSoleOwner;

              return (
                <li key={member.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-xs shadow">
                    {initial}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">
                        {member.user.displayName || member.user.email.split('@')[0]}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900/60 font-medium">You</span>
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
                      <div className="relative">
                        <select
                          id={`role-select-${member.userId}`}
                          value={member.role}
                          disabled={changingRole === member.userId}
                          onChange={(e) => void handleRoleChange(member.userId, e.target.value as MemberRole)}
                          className="appearance-none cursor-pointer rounded-md border border-neutral-700 bg-neutral-950 py-1.5 pl-3 pr-7 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 transition disabled:opacity-50"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        {changingRole === member.userId
                          ? <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-indigo-400" />
                          : <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500 pointer-events-none" />
                        }
                      </div>

                      {/* Remove */}
                      {confirmRemove === member.userId ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-red-400">Remove?</span>
                          <button
                            id={`confirm-remove-${member.userId}`}
                            onClick={() => void handleRemove(member.userId)}
                            disabled={removing === member.userId}
                            className="rounded px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold transition disabled:opacity-50"
                          >
                            {removing === member.userId ? '...' : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmRemove(null)} className="rounded px-2 py-1 border border-neutral-700 text-neutral-400 hover:text-white transition">
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`remove-member-${member.userId}`}
                          onClick={() => setConfirmRemove(member.userId)}
                          className="p-1.5 rounded-md text-neutral-500 hover:bg-red-950/40 hover:text-red-400 border border-transparent hover:border-red-900/40 transition"
                          title="Remove member"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
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
                  <button
                    id={`rescind-invite-${inv.id}`}
                    onClick={() => void handleRescind(inv.id)}
                    disabled={rescinding === inv.id}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border border-neutral-700 text-xs text-neutral-400 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 transition disabled:opacity-50"
                    title="Rescind invitation"
                  >
                    {rescinding === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    Rescind
                  </button>
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
