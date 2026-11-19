import { useEffect, useState } from "react";
import type { MemberRole, OrganizationMembership, PendingInvitation } from "@tellann/desktop-contracts";
import { Page, LoadingState, EmptyState } from "../../pages";
import { Table } from "../../components/ui/table";
import { Modal, ModalActions } from "../../components/ui/modal";
import { SelectField } from "../../components/ui/select";
import { confirmAction, formatEnum } from "../../components/desktop-ui";
import { useDesktop } from "../../desktop-context";
import { useActiveOrganization } from "./use-active-organization";
import { OrganizationSwitcher } from "./organization-switcher";
import { UserPlus, Users, X } from "lucide-react";

const ROLES: MemberRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export function MembersPage() {
  const { organizationId, organizations, setOrganizationId } = useActiveOrganization();
  const { session, organizationRoles, refreshMembers } = useDesktop();
  const [members, setMembers] = useState<OrganizationMembership[] | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const myRole = organizationId ? organizationRoles[organizationId] : undefined;
  const isOwner = myRole === "OWNER";

  const load = () => {
    if (!organizationId) return;
    setMembers(null);
    setError(null);
    refreshMembers(organizationId).then(setMembers).catch((err) => setError(String((err as Error)?.message ?? err)));
    window.tellann!.org.invitations(organizationId).then(setInvitations).catch(() => setInvitations([]));
  };

  useEffect(load, [organizationId]);

  const changeRole = async (userId: string, role: MemberRole) => {
    if (!organizationId) return;
    setBusyUserId(userId);
    setError(null);
    try {
      const updated = await window.tellann!.org.updateMemberRole(organizationId, userId, role);
      setMembers((current) => current?.map((m) => (m.userId === userId ? updated : m)) ?? current);
    } catch (err) {
      const code = (err as { message?: string })?.message ?? "";
      setError(code.includes("LAST_OWNER") ? "An organization must keep at least one Owner." : String(code));
    } finally {
      setBusyUserId(null);
    }
  };

  const removeMember = async (member: OrganizationMembership) => {
    if (!organizationId) return;
    const confirmed = await confirmAction({
      title: "Remove member",
      message: `Remove ${member.user.displayName ?? member.user.email} from this organization?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    setBusyUserId(member.userId);
    setError(null);
    try {
      await window.tellann!.org.removeMember(organizationId, member.userId);
      setMembers((current) => current?.filter((m) => m.userId !== member.userId) ?? current);
    } catch (err) {
      const code = (err as { message?: string })?.message ?? "";
      setError(code.includes("LAST_OWNER") ? "An organization must keep at least one Owner." : String(code));
    } finally {
      setBusyUserId(null);
    }
  };

  const sendInvite = async () => {
    if (!organizationId || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const invitation = await window.tellann!.org.createInvitation(organizationId, inviteEmail.trim(), inviteRole);
      setInvitations((current) => [invitation, ...(current ?? [])]);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("MEMBER");
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setInviting(false);
    }
  };

  const cancelInvite = async (invitation: PendingInvitation) => {
    if (!organizationId) return;
    await window.tellann!.org.cancelInvitation(organizationId, invitation.id);
    setInvitations((current) => current?.filter((item) => item.id !== invitation.id) ?? current);
  };

  return (
    <Page
      title="Team & Members"
      description="Who has access to this organization, and what they can do."
      toolbar={<OrganizationSwitcher organizations={organizations} organizationId={organizationId} onChange={setOrganizationId} />}
      actions={
        <button type="button" className="button primary" onClick={() => setInviteOpen(true)} disabled={!isOwner && myRole !== "ADMIN"}>
          <UserPlus size={14} /> Invite member
        </button>
      }
    >
      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <Table
        columns={[
          {
            key: "member",
            header: "Member",
            width: "2fr",
            render: (m: OrganizationMembership) => (
              <span>
                <strong>{m.user.displayName ?? m.user.email}</strong>
                {m.user.displayName ? <small style={{ display: "block", color: "var(--text-muted)" }}>{m.user.email}</small> : null}
              </span>
            ),
          },
          {
            key: "role",
            header: "Role",
            width: "160px",
            render: (m: OrganizationMembership) =>
              isOwner && m.userId !== session?.user?.id ? (
                <SelectField
                  ariaLabel={`Role for ${m.user.email}`}
                  value={m.role}
                  onValueChange={(value) => changeRole(m.userId, value as MemberRole)}
                  options={ROLES.map((role) => ({ value: role, label: formatEnum(role) }))}
                  disabled={busyUserId === m.userId}
                />
              ) : (
                <span>{formatEnum(m.role)}</span>
              ),
          },
          {
            key: "joined",
            header: "Joined",
            width: "140px",
            render: (m: OrganizationMembership) => new Date(m.createdAt).toLocaleDateString(),
          },
          {
            key: "actions",
            header: "",
            width: "80px",
            render: (m: OrganizationMembership) =>
              isOwner && m.userId !== session?.user?.id ? (
                <button type="button" className="button danger" title="Remove" onClick={() => removeMember(m)} disabled={busyUserId === m.userId}>
                  <X size={14} />
                </button>
              ) : null,
          },
        ]}
        rows={members ?? []}
        getKey={(m) => m.userId}
        loading={members === null}
        empty={<EmptyState icon={<Users size={28} />} title="No members yet" description="Invite teammates to collaborate on this organization." />}
      />

      {invitations?.length ? (
        <section className="content-card" style={{ marginTop: 16 }}>
          <h2>Pending invitations</h2>
          <div className="stack">
            {invitations.map((invite) => (
              <div className="settings-row-head" key={invite.id}>
                <span>
                  {invite.email} · {formatEnum(invite.role)}
                </span>
                <button type="button" className="button" onClick={() => cancelInvite(invite)}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a member">
        <label>
          Email address
          <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" autoFocus />
        </label>
        <label>
          Role
          <SelectField
            ariaLabel="Role"
            value={inviteRole}
            onValueChange={(value) => setInviteRole(value as MemberRole)}
            options={ROLES.filter((role) => role !== "OWNER").map((role) => ({ value: role, label: formatEnum(role) }))}
          />
        </label>
        <ModalActions
          onCancel={() => setInviteOpen(false)}
          onConfirm={sendInvite}
          confirmLabel={inviting ? "Sending…" : "Send invite"}
          confirmDisabled={inviting || !inviteEmail.trim()}
        />
      </Modal>
    </Page>
  );
}
