import { useEffect } from 'react';
import { FolderSearch } from 'lucide-react';
import { useDesktop } from '../desktop-context';

/**
 * Raised when a folder is attached to an application already bound to another
 * repository.
 *
 * The cloud refuses the attach, and the user's only useful next move is to pick
 * a different folder — so this is a modal with that exact action rather than a
 * dismissible banner above a page they may not be looking at. Every dismissal
 * path leaves the application as it was: the rejected folder was never bound.
 */
export function RepositoryMismatchModal() {
  const { repositoryMismatch, dismissRepositoryMismatch, attachWorkspace, busy } = useDesktop();

  useEffect(() => {
    if (!repositoryMismatch) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissRepositoryMismatch();
    };
    document.addEventListener('keydown', dismissOnEscape);
    return () => document.removeEventListener('keydown', dismissOnEscape);
  }, [repositoryMismatch, dismissRepositoryMismatch]);

  if (!repositoryMismatch) return null;

  const chooseAnother = () => {
    const { applicationId } = repositoryMismatch;
    // Closed before the native picker opens so the folder dialog is not stacked
    // behind a dialog of our own. A second wrong folder re-opens this modal.
    dismissRepositoryMismatch();
    void attachWorkspace(applicationId);
  };

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismissRepositoryMismatch();
      }}
    >
      <div
        className="desktop-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="repository-mismatch-title"
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-white text-[20px] font-extrabold tracking-tight">TELLANN</span>
          <span className="border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[0.08em] uppercase">
            FOLDER // MISMATCH
          </span>
        </div>

        <h2 id="repository-mismatch-title">That folder is a different repository</h2>
        <p>{repositoryMismatch.message}</p>

        {repositoryMismatch.expectedCloneUrl ? (
          <div className="context-banner">
            <p className="m-0! leading-relaxed text-left break-words">
              This application is bound to{' '}
              <code className="bg-[#18181b] text-[#ffffff] px-1.5 py-0.5 rounded font-mono text-[12px] border border-[#27272a] break-all inline">
                {repositoryMismatch.expectedCloneUrl}
              </code>
              . Choose your local checkout of that repository instead.
            </p>
          </div>
        ) : null}

        {/* <div className="permission-summary">
          <FolderSearch />
          <div>
            <strong>Nothing was attached</strong>
            <p>
              The folder you picked was not linked to this application and nothing was uploaded.
              Pick the right folder to continue, or close this and attach one later.
            </p>
          </div>
        </div> */}

        <div className="desktop-modal-actions">
          <button type="button" onClick={dismissRepositoryMismatch}>
            Cancel
          </button>
          <button className="confirm" type="button" disabled={busy} onClick={chooseAnother}>
            Choose another folder
          </button>
        </div>
      </div>
    </div>
  );
}
