import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { CodebaseUploadConsentRequest } from '@tellann/desktop-contracts';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeRepository(request: CodebaseUploadConsentRequest): string {
  const branch = request.branch ? ` on ${request.branch}` : '';
  const revision = request.revision ? ` at ${request.revision.slice(0, 8)}` : '';
  const dirty = request.dirty ? ' (including uncommitted changes)' : '';
  return `${request.repositoryLabel}${branch}${revision}${dirty}`;
}

/**
 * In-app consent for uploading source for full codebase analysis.
 *
 * The main process plans the sanitized archive first and sends the real figures
 * here, so the numbers below describe the actual payload. Every dismissal path
 * — the button, Escape, the backdrop — answers "keep local", because declining
 * must never require finding the right control.
 */
export function UploadConsentModal() {
  const [request, setRequest] = useState<CodebaseUploadConsentRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const answer = useCallback((consented: boolean) => {
    setRequest((current) => {
      if (!current) return null;
      setSubmitting(true);
      void window.tellann?.projects
        .resolveUploadConsent(current.requestId, consented)
        .catch(() => undefined)
        .finally(() => setSubmitting(false));
      return null;
    });
  }, []);

  useEffect(() => {
    if (!window.tellann?.projects?.onUploadConsentRequested) return;
    return window.tellann.projects.onUploadConsentRequested(setRequest);
  }, []);

  useEffect(() => {
    if (!request) return;
    const keepLocalOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') answer(false);
    };
    document.addEventListener('keydown', keepLocalOnEscape);
    return () => document.removeEventListener('keydown', keepLocalOnEscape);
  }, [request, answer]);

  if (!request) return null;

  const exclusions = request.exclusions
    .map((item) => `${item.count} ${item.reason}`)
    .join(', ');

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) answer(false);
      }}
    >
      <div
        className="desktop-modal consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-consent-title"
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-white text-[20px] font-extrabold tracking-tight">TELLANN</span>
          <span className="border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[0.08em] uppercase">
            SOURCE // CONSENT
          </span>
        </div>

        <h2 id="upload-consent-title">
          Upload {request.fileCount} files ({formatBytes(request.compressedBytes)} compressed) for
          full codebase analysis?
        </h2>

        <table role="presentation" className="consent-table">
          <tbody>
            <tr>
              <td>REPOSITORY</td>
              <td>{describeRepository(request)}</td>
            </tr>
            <tr>
              <td>WORKSPACE</td>
              <td>{request.workspaceName}</td>
            </tr>
            <tr>
              <td>LANGUAGES</td>
              <td>{request.languages.join(', ') || 'None detected'}</td>
            </tr>
            <tr>
              <td>REDACTED</td>
              <td>
                {request.redactions
                  ? `${request.redactions} secret-shaped value${request.redactions === 1 ? '' : 's'} across ${request.redactedFiles} file${request.redactedFiles === 1 ? '' : 's'} replaced with [redacted]`
                  : 'No secret-shaped values found'}
              </td>
            </tr>
            <tr>
              <td>EXCLUDED</td>
              <td>{exclusions ? `${exclusions} — never uploaded` : 'Nothing was excluded'}</td>
            </tr>
          </tbody>
        </table>

        {request.truncated ? (
          <div className="context-banner">
            This repository exceeds the upload budget, so lower-priority files (documentation
            first) are left out and reported.
          </div>
        ) : null}

        {/* <div className="permission-summary">
          <ShieldCheck />
          <div>
            <strong>What happens to the snapshot</strong>
            <p>
              It is encrypted before upload, tied to this exact revision, and deleted
              automatically under your organization retention policy. Keeping it local runs the
              same analysis on this machine instead, and nothing is uploaded.
            </p>
          </div>
        </div> */}

        <div className="desktop-modal-actions">
          <button type="button" disabled={submitting} onClick={() => answer(false)}>
            Keep analysis local
          </button>
          <button
            className="confirm"
            type="button"
            disabled={submitting}
            onClick={() => answer(true)}
          >
            Upload and analyze
          </button>
        </div>
      </div>
    </div>
  );
}
