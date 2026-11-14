import { useEffect, useState } from "react";
import type { MfaStatus, PairedDevice } from "@tellann/desktop-contracts";
import { Page, LoadingState } from "../../pages";
import { Modal, ModalActions } from "../../components/ui/modal";
import { confirmAction, formatEnum } from "../../components/desktop-ui";
import { Copy, Download, ShieldCheck, Smartphone } from "lucide-react";

export function SecurityPage() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [devices, setDevices] = useState<PairedDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupData, setSetupData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disableProof, setDisableProof] = useState("");

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const load = () => {
    window.tellann!.mfa.status().then(setStatus).catch((err) => setError(String((err as Error)?.message ?? err)));
    window.tellann!.mfa.devices().then(setDevices).catch(() => setDevices([]));
  };

  useEffect(load, []);

  const startSetup = async () => {
    setError(null);
    try {
      const result = await window.tellann!.mfa.setup();
      setSetupData({ qrDataUrl: result.qrDataUrl, secret: result.secret });
      setSetupOpen(true);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    }
  };

  const confirmSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.tellann!.mfa.enable(code);
      setBackupCodes(result.backupCodes);
      setSetupOpen(false);
      setCode("");
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const closeBackupCodes = () => {
    setBackupCodes(null);
    setSavedConfirmed(false);
    load();
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const isPassword = disableProof.length > 6 && !/^\d+$/.test(disableProof);
      await window.tellann!.mfa.disable(isPassword ? { password: disableProof } : { token: disableProof });
      setDisableOpen(false);
      setDisableProof("");
      load();
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const revokeDevice = async (device: PairedDevice) => {
    const confirmed = await confirmAction({
      title: "Revoke device",
      message: `Sign "${device.deviceName ?? "this device"}" out of Tellann?`,
      confirmLabel: "Revoke",
      danger: true,
    });
    if (!confirmed) return;
    await window.tellann!.mfa.revokeDevice(device.id);
    setDevices((current) => current?.filter((d) => d.id !== device.id) ?? current);
  };

  const savePassword = async () => {
    if (!newPassword) return;
    setBusy(true);
    setError(null);
    try {
      await window.tellann!.mfa.setPassword({ password: newPassword });
      setPasswordOpen(false);
      setNewPassword("");
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const copyBackupCodes = () => {
    if (!backupCodes) return;
    void window.tellann?.system.copyText(backupCodes.join("\n"));
  };

  if (!status) return <LoadingState />;

  return (
    <Page title="Security & MFA" description="Two-factor authentication, password, and devices paired with your account.">
      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="stack">
        <section className="content-card">
          <header className="settings-row-head">
            <h2>Two-factor authentication</h2>
            {status.mfaEnabled ? <span className="status-pill" data-tone="success"><span />Enabled</span> : null}
          </header>
          <p className="muted">
            {status.mfaEnabled
              ? `Protected via ${formatEnum(status.mfaMethod ?? "")}. ${status.backupCodesRemaining} backup codes remaining.`
              : "Add a second factor so a leaked password alone can't sign in to your account."}
          </p>
          <div className="desktop-modal-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            {status.mfaEnabled ? (
              <button type="button" className="button danger" onClick={() => setDisableOpen(true)}>
                Disable MFA
              </button>
            ) : (
              <button type="button" className="button primary" onClick={startSetup}>
                <ShieldCheck size={14} /> Set up authenticator app
              </button>
            )}
          </div>
        </section>

        <section className="content-card">
          <h2>Password</h2>
          <p className="muted">Set or change the password used for the web dashboard's sign-in.</p>
          <div className="desktop-modal-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <button type="button" className="button" onClick={() => setPasswordOpen(true)}>
              Change password
            </button>
          </div>
        </section>

        <section className="content-card">
          <h2>Paired devices</h2>
          {devices === null ? (
            <LoadingState />
          ) : devices.length ? (
            <div className="stack">
              {devices.map((device) => (
                <div className="settings-row-head" key={device.id}>
                  <span>
                    <Smartphone size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    {device.deviceName ?? "Unknown device"} · {formatEnum(device.platform ?? "")}
                  </span>
                  <button type="button" className="button danger" onClick={() => revokeDevice(device)}>
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No other devices paired.</p>
          )}
        </section>
      </div>

      <Modal isOpen={setupOpen} onClose={() => setSetupOpen(false)} title="Set up an authenticator app">
        {setupData ? (
          <div className="stack">
            <p className="muted">Scan this code with Google Authenticator, 1Password, or any TOTP app.</p>
            <img src={setupData.qrDataUrl} alt="TOTP QR code" width={180} height={180} style={{ alignSelf: "center" }} />
            <p className="muted" style={{ textAlign: "center" }}>
              Or enter manually: <code>{setupData.secret}</code>
            </p>
            <label>
              6-digit code
              <input type="text" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} autoFocus />
            </label>
          </div>
        ) : null}
        <ModalActions onCancel={() => setSetupOpen(false)} onConfirm={confirmSetup} confirmLabel={busy ? "Verifying…" : "Enable"} confirmDisabled={busy || code.length !== 6} />
      </Modal>

      <Modal isOpen={backupCodes !== null} onClose={savedConfirmed ? closeBackupCodes : () => undefined} dismissible={savedConfirmed} title="Save your backup codes">
        <p className="muted">
          Each code can be used once if you lose access to your authenticator app. They're shown only this one time.
        </p>
        <pre className="backup-codes-block">{backupCodes?.join("\n")}</pre>
        <div className="desktop-modal-actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="button" onClick={copyBackupCodes}>
            <Copy size={14} /> Copy
          </button>
        </div>
        <label className="settings-toggle" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={savedConfirmed} onChange={(event) => setSavedConfirmed(event.target.checked)} />
          <span>I've saved these codes somewhere safe</span>
        </label>
        <ModalActions
          onCancel={closeBackupCodes}
          cancelLabel="Close"
          onConfirm={closeBackupCodes}
          confirmLabel="Done"
          confirmDisabled={!savedConfirmed}
        />
      </Modal>

      <Modal isOpen={disableOpen} onClose={() => setDisableOpen(false)} title="Disable MFA">
        <label>
          Current code or password
          <input type="text" value={disableProof} onChange={(event) => setDisableProof(event.target.value)} autoFocus />
        </label>
        <ModalActions onCancel={() => setDisableOpen(false)} onConfirm={disable} confirmLabel={busy ? "Disabling…" : "Disable"} confirmDisabled={busy || !disableProof} danger />
      </Modal>

      <Modal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} title="Set a password">
        <label>
          New password
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoFocus />
        </label>
        <ModalActions onCancel={() => setPasswordOpen(false)} onConfirm={savePassword} confirmLabel={busy ? "Saving…" : "Save"} confirmDisabled={busy || newPassword.length < 8} />
      </Modal>
    </Page>
  );
}
