import { useEffect, useRef, useState } from "react";
import type { BillingProfile, UserProfile } from "@tellann/desktop-contracts";
import { Page, LoadingState } from "../../pages";
import { confirmAction } from "../../components/desktop-ui";
import { useDesktop } from "../../desktop-context";
import { Trash2, Upload } from "lucide-react";

const DICEBEAR_STYLES = ["identicon", "shapes", "thumbs", "bottts", "pixel-art"];

function diceBearUrl(seed: string, style: string): string {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export function ProfilePage() {
  const { avatarDataUri, refreshAvatar } = useDesktop();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [billing, setBilling] = useState<BillingProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([window.tellann!.account.getMe(), window.tellann!.account.getBillingProfile()])
      .then(([profile, billingProfile]) => {
        setMe(profile);
        setDisplayName(profile.displayName ?? "");
        setBilling(billingProfile);
      })
      .catch((err) => setError(String((err as Error)?.message ?? err)));
  }, []);

  const saveDisplayName = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await window.tellann!.account.updateMe({ displayName: displayName.trim() || undefined });
      setMe(updated);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  const saveBillingField = async (patch: Partial<BillingProfile>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await window.tellann!.account.updateBillingProfile(patch);
      setBilling(updated);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !window.tellann?.system.getPathForFile) return;
    const path = window.tellann.system.getPathForFile(file);
    if (!path) return;
    setSaving(true);
    setError(null);
    try {
      await window.tellann!.account.uploadAvatar(path);
      refreshAvatar();
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  const pickGeneratedAvatar = async (style: string) => {
    if (!me) return;
    setSaving(true);
    setError(null);
    try {
      await window.tellann!.account.setGeneratedAvatar(diceBearUrl(me.id, style));
      refreshAvatar();
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = async () => {
    const confirmed = await confirmAction({
      title: "Remove avatar",
      message: "Remove your profile picture?",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      await window.tellann!.account.deleteAvatar();
      refreshAvatar();
    } finally {
      setSaving(false);
    }
  };

  if (!me) return <LoadingState />;

  return (
    <Page title="Profile" description="Your name, avatar, and billing identity.">
      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="stack">
        <section className="content-card">
          <h2>Identity</h2>
          <div className="settings-field-row" style={{ borderTop: "none", paddingTop: 0, marginTop: 10 }}>
            <span className="muted">Email</span>
            <span>{me.email}</span>
          </div>
          <label>
            <span>Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
            />
          </label>
          <div className="desktop-modal-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <button type="button" className="button primary" onClick={saveDisplayName} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </section>

        <section className="content-card">
          <h2>Avatar</h2>
          <div className="settings-toggle-grid" style={{ alignItems: "center" }}>
            {avatarDataUri ? (
              <img src={avatarDataUri} alt="" width={40} height={40} style={{ borderRadius: "999px" }} />
            ) : (
              <span className="profile-avatar" aria-hidden="true">
                {(me.displayName ?? me.email).slice(0, 1).toUpperCase()}
              </span>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPickAvatarFile} />
            <button type="button" className="button" onClick={() => fileInputRef.current?.click()} disabled={saving}>
              <Upload size={14} /> Upload image
            </button>
            <button type="button" className="button danger" onClick={removeAvatar} disabled={saving}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>Or pick a generated avatar:</p>
          <div className="settings-toggle-grid">
            {DICEBEAR_STYLES.map((style) => (
              <button
                type="button"
                key={style}
                className="button"
                onClick={() => pickGeneratedAvatar(style)}
                disabled={saving}
                title={style}
              >
                <img src={diceBearUrl(me.id, style)} alt={style} width={28} height={28} />
              </button>
            ))}
          </div>
        </section>

        <section className="content-card">
          <h2>Billing identity</h2>
          <p className="muted">Used on invoices across every organization you pay for.</p>
          {billing ? (
            <div className="stack" style={{ marginTop: 10 }}>
              <label>
                <span>Legal name</span>
                <input
                  type="text"
                  defaultValue={billing.legalName ?? ""}
                  onBlur={(event) => saveBillingField({ legalName: event.target.value || null })}
                />
              </label>
              <label>
                <span>Billing email</span>
                <input
                  type="email"
                  defaultValue={billing.billingEmail ?? ""}
                  onBlur={(event) => saveBillingField({ billingEmail: event.target.value || null })}
                />
              </label>
              <label>
                <span>Tax ID</span>
                <input
                  type="text"
                  defaultValue={billing.taxId ?? ""}
                  onBlur={(event) => saveBillingField({ taxId: event.target.value || null })}
                />
              </label>
            </div>
          ) : (
            <LoadingState />
          )}
        </section>

        <section className="content-card">
          <h2>Account</h2>
          <p className="muted">
            Deleting your account is handled from the web dashboard's Data &amp; Privacy settings, which walks through
            the 30-day restoration window and any active subscriptions first.
          </p>
        </section>
      </div>
    </Page>
  );
}
