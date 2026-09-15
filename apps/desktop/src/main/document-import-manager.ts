import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { extractDocument } from '@tellann/document-intelligence';
import type { DesktopCloudClient } from './cloud-client';
import { deleteLocalState, listLocalStateKeys, readLocalState, writeLocalState } from './local-store';

/**
 * Runs "add documents → process evidence → generate a flow draft" in the main
 * process so it keeps going when the member leaves the Intent page.
 *
 * The renderer used to drive every step itself. Navigating away unmounted the
 * page mid-extraction, the finished upload results were discarded, document
 * jobs were never polled and no draft was ever requested — the import simply
 * vanished. Here each import is persisted in the encrypted local store and
 * broadcast as it changes, so any page can show it and an import interrupted
 * by closing the desktop resumes from the step it reached.
 */

export type DocumentImportStage =
  | 'EXTRACTING_AND_UPLOADING'
  | 'PROCESSING_DOCUMENTS'
  | 'GENERATING_DRAFT'
  | 'DOCUMENTS_READY'
  | 'DRAFT_READY'
  | 'FAILED'
  | 'CANCELLED';

export type DocumentImportFileStatus =
  | 'WAITING'
  | 'EXTRACTING'
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED';

export type DocumentImportFile = {
  id: string;
  filename: string;
  status: DocumentImportFileStatus;
  documentId: string | null;
  jobId: string | null;
  versionId: string | null;
  deduplicated: boolean;
  errorMessageSafe: string | null;
};

export type DocumentImportSession = {
  id: string;
  applicationId: string;
  /** False for uploads from Sources, which only add documents. */
  generateDraft: boolean;
  stage: DocumentImportStage;
  message: string | null;
  /** Kept apart from `message` so later progress never hides that files failed. */
  failedFileCount: number;
  files: DocumentImportFile[];
  draftJobId: string | null;
  draftJobStatus: string | null;
  draftId: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

/** What the renderer sees: the stored session plus whether this process is still working on it. */
export type DocumentImportView = DocumentImportSession & { running: boolean };

type DocumentImportManagerOptions = {
  cloud: DesktopCloudClient;
  publish(view: DocumentImportView): void;
  notify(input: { title: string; body: string; deepLink: string }): void;
  repositorySnapshotId(applicationId: string): string | null | undefined;
  safeError(error: unknown): string;
  sourceKey(filePath: string): string | null;
};

const STORE_PREFIX = 'document-import:';
const MAX_FILES = 20;
const POLL_INTERVAL_MS = 2_000;
const DOCUMENT_WAIT_LIMIT_MS = 20 * 60_000;
const DRAFT_WAIT_LIMIT_MS = 20 * 60_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 15;
const ACTIVE_STAGES: DocumentImportStage[] = ['EXTRACTING_AND_UPLOADING', 'PROCESSING_DOCUMENTS', 'GENERATING_DRAFT'];
const TERMINAL_JOB_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const stringOrNull = (value: unknown) => (typeof value === 'string' && value ? value : null);
const statusOf = (error: unknown) => (error as { status?: number } | null)?.status;

export function isActiveDocumentImportStage(stage: DocumentImportStage): boolean {
  return ACTIVE_STAGES.includes(stage);
}

export class DocumentImportManager {
  private readonly sessions = new Map<string, DocumentImportSession>();
  private readonly runners = new Map<string, Promise<void>>();
  private readonly cancelRequested = new Set<string>();

  constructor(private readonly options: DocumentImportManagerOptions) {}

  get(applicationId: string): DocumentImportView | null {
    const session = this.load(applicationId);
    return session ? this.view(session) : null;
  }

  /** Adds local files, and unless `generateDraft` is false, generates a review draft from them. */
  startFromFiles(applicationId: string, filePaths: string[], generateDraft: boolean): DocumentImportView {
    this.assertIdle(applicationId);
    const selected = filePaths.slice(0, MAX_FILES);
    const session = this.create(applicationId, generateDraft, 'EXTRACTING_AND_UPLOADING', selected.map((filePath) => ({
      id: crypto.randomUUID(), filename: path.basename(filePath), status: 'WAITING', documentId: null,
      jobId: null, versionId: null, deduplicated: false, errorMessageSafe: null,
    })));
    this.run(applicationId, selected);
    return this.view(session);
  }

  /** Generates a review draft from document versions that are already processed. */
  startFromVersions(applicationId: string, documents: Array<{ versionId: string; documentId: string | null; filename: string }>): DocumentImportView {
    this.assertIdle(applicationId);
    if (!documents.length) throw new Error('INTENT_SOURCE_REQUIRED');
    const session = this.create(applicationId, true, 'GENERATING_DRAFT', documents.map((document) => ({
      id: crypto.randomUUID(), filename: document.filename, status: 'READY', documentId: document.documentId,
      jobId: null, versionId: document.versionId, deduplicated: true, errorMessageSafe: null,
    })));
    this.run(applicationId);
    return this.view(session);
  }

  /**
   * Continues an import this process is not working on: one interrupted by
   * closing the desktop, or one that stopped waiting (offline, or slower than
   * the wait limit). Server jobs that already exist are reused, never duplicated.
   */
  resume(applicationId: string): DocumentImportView | null {
    const session = this.load(applicationId);
    if (!session) return null;
    if (this.runners.has(applicationId)) return this.view(session);
    const pendingDocuments = session.files.some((file) => file.jobId && !file.versionId && ['QUEUED', 'PROCESSING'].includes(file.status));
    const draftUnfinished = session.generateDraft && !session.draftId
      && session.files.some((file) => file.versionId);
    if (session.stage === 'EXTRACTING_AND_UPLOADING') {
      // Local paths are not stored, so files that never reached Tellann cannot continue.
      for (const file of session.files) {
        if (['WAITING', 'EXTRACTING', 'UPLOADING'].includes(file.status)) {
          this.failFile(session, file, 'Tellann closed before this file finished uploading. Add it again.');
        }
      }
      session.stage = 'PROCESSING_DOCUMENTS';
    } else if (session.stage === 'FAILED' || isActiveDocumentImportStage(session.stage)) {
      if (pendingDocuments) {
        session.stage = 'PROCESSING_DOCUMENTS';
      } else if (draftUnfinished) {
        // A generation job that ended in failure is replaced by a new one; a
        // job still queued or running is polled again.
        if (session.draftJobId && TERMINAL_JOB_STATUSES.includes(session.draftJobStatus ?? '')) {
          session.draftJobId = null;
          session.draftJobStatus = null;
        }
        session.stage = 'GENERATING_DRAFT';
      } else if (!isActiveDocumentImportStage(session.stage)) {
        return this.view(session);
      }
    } else {
      return this.view(session);
    }
    session.message = null;
    session.finishedAt = null;
    this.save(session);
    this.run(applicationId);
    return this.view(session);
  }

  /** Resumes every stored import that was still working when the desktop last closed. */
  resumeAll(): void {
    for (const key of this.storedKeys()) {
      const applicationId = key.slice(STORE_PREFIX.length);
      const session = this.load(applicationId);
      if (session && isActiveDocumentImportStage(session.stage)) this.resume(applicationId);
    }
  }

  async cancel(applicationId: string): Promise<DocumentImportView | null> {
    const session = this.load(applicationId);
    if (!session || !isActiveDocumentImportStage(session.stage)) return session ? this.view(session) : null;
    if (session.stage === 'GENERATING_DRAFT' && session.draftJobId) {
      // Throws DRAFT_JOB_CANNOT_BE_CANCELLED once the worker has started; the
      // import then keeps waiting for the draft.
      await this.options.cloud.cancelIntentDraftJob(applicationId, session.draftJobId);
      session.draftJobStatus = 'CANCELLED';
    }
    if (this.runners.has(applicationId)) {
      this.cancelRequested.add(applicationId);
    } else {
      this.finish(session, 'CANCELLED', this.cancelMessage(session));
    }
    return this.view(session);
  }

  /** Removes a finished import from view. */
  dismiss(applicationId: string): void {
    const session = this.load(applicationId);
    if (session && this.runners.has(applicationId)) throw new Error('INTENT_IMPORT_IN_PROGRESS');
    this.sessions.delete(applicationId);
    try {
      deleteLocalState(`${STORE_PREFIX}${applicationId}`);
    } catch {
      // Nothing stored.
    }
  }

  /** Forgets every import, for example when the member signs out. */
  clearAll(): void {
    for (const applicationId of this.runners.keys()) this.cancelRequested.add(applicationId);
    for (const key of this.storedKeys()) {
      try {
        deleteLocalState(key);
      } catch {
        // Already gone.
      }
    }
    this.sessions.clear();
  }

  private assertIdle(applicationId: string): void {
    const existing = this.load(applicationId);
    if (this.runners.has(applicationId) || (existing && isActiveDocumentImportStage(existing.stage))) {
      throw new Error('INTENT_IMPORT_IN_PROGRESS');
    }
  }

  private create(
    applicationId: string,
    generateDraft: boolean,
    stage: DocumentImportStage,
    files: DocumentImportFile[],
  ): DocumentImportSession {
    const now = new Date().toISOString();
    const session: DocumentImportSession = {
      id: crypto.randomUUID(), applicationId, generateDraft, stage, message: null, failedFileCount: 0, files,
      draftJobId: null, draftJobStatus: null, draftId: null, startedAt: now, updatedAt: now, finishedAt: null,
    };
    this.cancelRequested.delete(applicationId);
    this.save(session);
    return session;
  }

  private run(applicationId: string, filePaths?: string[]): void {
    if (this.runners.has(applicationId)) return;
    const runner = Promise.resolve()
      .then(() => this.execute(applicationId, filePaths))
      .catch((error) => {
        const session = this.load(applicationId);
        if (session && isActiveDocumentImportStage(session.stage)) this.finish(session, 'FAILED', this.options.safeError(error));
      })
      .finally(() => {
        this.runners.delete(applicationId);
        this.cancelRequested.delete(applicationId);
        const session = this.load(applicationId);
        if (session) this.options.publish(this.view(session));
      });
    this.runners.set(applicationId, runner);
  }

  private async execute(applicationId: string, filePaths?: string[]): Promise<void> {
    const session = this.load(applicationId);
    if (!session) return;

    if (session.stage === 'EXTRACTING_AND_UPLOADING') {
      await this.uploadFiles(session, filePaths ?? []);
      if (this.cancelRequested.has(applicationId)) return this.finish(session, 'CANCELLED', this.cancelMessage(session));
      session.stage = 'PROCESSING_DOCUMENTS';
      this.save(session);
    }

    if (session.stage === 'PROCESSING_DOCUMENTS') {
      if (!await this.waitForDocuments(session)) return;
      const ready = session.files.filter((file) => file.versionId);
      session.failedFileCount = session.files.filter((file) => file.status === 'FAILED').length;
      if (!ready.length) {
        this.finish(session, 'FAILED', 'None of the selected files produced usable evidence. Check the file errors, then add them again.');
        this.notifyFinished(session);
        return;
      }
      if (!session.generateDraft) {
        this.finish(session, 'DOCUMENTS_READY', `${ready.length} document(s) ready for flow generation.`);
        return;
      }
      session.stage = 'GENERATING_DRAFT';
      this.save(session);
    }

    if (session.stage === 'GENERATING_DRAFT') await this.generate(session);
  }

  private async uploadFiles(session: DocumentImportSession, filePaths: string[]): Promise<void> {
    const { cloud, safeError, sourceKey } = this.options;
    for (let index = 0; index < session.files.length; index += 1) {
      const file = session.files[index];
      const filePath = filePaths[index];
      if (this.cancelRequested.has(session.applicationId)) break;
      if (!filePath) {
        this.failFile(session, file, 'Tellann closed before this file finished uploading. Add it again.');
        continue;
      }
      file.status = 'EXTRACTING';
      this.save(session);
      try {
        const buffer = await fs.readFile(filePath);
        const manifest = await extractDocument({ buffer, filename: file.filename });
        file.status = 'UPLOADING';
        this.save(session);
        let key: string | null = null;
        try {
          key = sourceKey(filePath);
        } catch {
          // Without protected storage the document is identified by name only.
        }
        const response = await cloud.uploadDerivedDocument(session.applicationId, key ? { ...manifest, sourceKey: key } : manifest) as Record<string, unknown>;
        file.documentId = stringOrNull(response.documentId);
        file.jobId = stringOrNull(response.jobId);
        file.versionId = stringOrNull(response.versionId);
        file.deduplicated = response.deduplicated === true;
        file.status = file.versionId ? 'READY' : response.status === 'PROCESSING' ? 'PROCESSING' : 'QUEUED';
        file.errorMessageSafe = null;
      } catch (error) {
        const message = safeError(error);
        this.failFile(session, file, message);
        if (message.includes('FEATURE_NOT_ENTITLED') || statusOf(error) === 401) {
          for (const remaining of session.files.slice(index + 1)) this.failFile(session, remaining, message);
          break;
        }
      }
      this.save(session);
    }
    for (const file of session.files) {
      if (file.status === 'WAITING') {
        file.status = 'CANCELLED';
        file.errorMessageSafe = 'Cancelled before upload.';
      }
    }
    this.save(session);
  }

  /** Returns false when the import stopped (cancelled, timed out or offline) instead of reaching the next step. */
  private async waitForDocuments(session: DocumentImportSession): Promise<boolean> {
    const { cloud } = this.options;
    const deadline = Date.now() + DOCUMENT_WAIT_LIMIT_MS;
    let consecutiveErrors = 0;
    for (;;) {
      const pending = session.files.filter((file) => file.jobId && !file.versionId && ['QUEUED', 'PROCESSING'].includes(file.status));
      if (!pending.length) return true;
      if (this.cancelRequested.has(session.applicationId)) {
        this.finish(session, 'CANCELLED', this.cancelMessage(session));
        return false;
      }
      if (Date.now() > deadline) {
        this.finish(session, 'FAILED', 'Document processing is taking longer than expected. Check again later; no file will be uploaded twice.');
        return false;
      }
      const results = await Promise.allSettled(pending.map((file) => cloud.documentJob(session.applicationId, file.jobId!)));
      let unreachable = false;
      results.forEach((result, index) => {
        const file = pending[index];
        if (result.status === 'rejected') {
          if (statusOf(result.reason) === 404) this.failFile(session, file, 'Tellann no longer has this upload. Add the file again.');
          else unreachable = true;
          return;
        }
        const job = result.value;
        if (job.status === 'COMPLETED' && job.resultVersionId) {
          file.versionId = job.resultVersionId;
          file.status = 'READY';
          file.errorMessageSafe = null;
        } else if (job.status === 'FAILED') {
          this.failFile(session, file, job.errorMessageSafe ?? 'Document processing failed.');
        } else if (job.status === 'CANCELLED') {
          this.failFile(session, file, job.errorMessageSafe ?? 'This upload was replaced by a newer upload of the same file.');
        } else {
          file.status = job.status === 'PROCESSING' ? 'PROCESSING' : 'QUEUED';
          // Surfaces "will retry" notes from the processing worker.
          file.errorMessageSafe = job.errorMessageSafe ?? null;
        }
      });
      consecutiveErrors = unreachable ? consecutiveErrors + 1 : 0;
      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        this.finish(session, 'FAILED', 'Tellann could not be reached to check document processing. Check again when you are back online.');
        return false;
      }
      this.save(session);
      await delay(POLL_INTERVAL_MS);
    }
  }

  private async generate(session: DocumentImportSession): Promise<void> {
    const { cloud, repositorySnapshotId } = this.options;
    const applicationId = session.applicationId;
    if (!session.draftJobId) {
      const versionIds = [...new Set(session.files.flatMap((file) => (file.versionId ? [file.versionId] : [])))];
      const created = await cloud.createIntentDraft(applicationId, versionIds, repositorySnapshotId(applicationId));
      session.draftJobId = created.jobId;
      session.draftJobStatus = created.status;
      this.save(session);
    }
    const deadline = Date.now() + DRAFT_WAIT_LIMIT_MS;
    let consecutiveErrors = 0;
    for (;;) {
      if (this.cancelRequested.has(applicationId)) return this.finish(session, 'CANCELLED', this.cancelMessage(session));
      let job: Awaited<ReturnType<DesktopCloudClient['intentDraftJob']>>;
      try {
        job = await cloud.intentDraftJob(applicationId, session.draftJobId!);
        consecutiveErrors = 0;
      } catch (error) {
        if (statusOf(error) === 404) {
          session.draftJobStatus = 'FAILED';
          this.finish(session, 'FAILED', 'The generation job no longer exists. Check again to start a new one.');
          return;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          this.finish(session, 'FAILED', 'Tellann could not be reached to check generation. Check again when you are back online; no duplicate job will be created.');
          return;
        }
        await delay(POLL_INTERVAL_MS);
        continue;
      }
      session.draftJobStatus = job.status;
      if (job.status === 'COMPLETED' && job.draftId) {
        session.draftId = job.draftId;
        this.finish(session, 'DRAFT_READY', 'Your flow draft is ready for review.');
        this.notifyFinished(session);
        return;
      }
      if (job.status === 'FAILED') {
        this.finish(session, 'FAILED', job.errorMessageSafe ?? 'Flow draft generation failed.');
        this.notifyFinished(session);
        return;
      }
      if (job.status === 'CANCELLED') {
        this.finish(session, 'CANCELLED', 'Generation cancelled. Your documents are still available to generate from.');
        return;
      }
      if (Date.now() > deadline) {
        this.finish(session, 'FAILED', 'Generation is still running on Tellann. Check again to keep waiting; no duplicate job will be created.');
        return;
      }
      this.save(session);
      await delay(POLL_INTERVAL_MS);
    }
  }

  private cancelMessage(session: DocumentImportSession): string {
    return session.files.some((file) => file.jobId || file.versionId)
      ? 'Import stopped. Files that already reached Tellann keep processing and appear in Sources.'
      : 'Import stopped before any file was uploaded.';
  }

  private notifyFinished(session: DocumentImportSession): void {
    const base = `/applications/${session.applicationId}`;
    if (session.stage === 'DRAFT_READY' && session.draftId) {
      this.options.notify({
        title: 'Flow draft ready',
        body: 'Tellann generated flows from your documents. Review them before they become expected behavior.',
        deepLink: `${base}/intent/drafts/${session.draftId}`,
      });
    } else if (session.stage === 'FAILED') {
      this.options.notify({ title: 'Flow generation stopped', body: session.message ?? 'Open Intent to see what happened.', deepLink: `${base}/intent` });
    }
  }

  private failFile(session: DocumentImportSession, file: DocumentImportFile, message: string): void {
    file.status = 'FAILED';
    file.errorMessageSafe = message;
    session.failedFileCount = session.files.filter((candidate) => candidate.status === 'FAILED').length;
  }

  private finish(session: DocumentImportSession, stage: DocumentImportStage, message: string | null): void {
    session.stage = stage;
    session.message = message;
    session.finishedAt = new Date().toISOString();
    this.save(session);
  }

  private save(session: DocumentImportSession): void {
    session.updatedAt = new Date().toISOString();
    this.sessions.set(session.applicationId, session);
    try {
      writeLocalState(`${STORE_PREFIX}${session.applicationId}`, session);
    } catch {
      // Without protected storage the import still runs; it just cannot resume after a restart.
    }
    this.options.publish(this.view(session));
  }

  private load(applicationId: string): DocumentImportSession | null {
    const cached = this.sessions.get(applicationId);
    if (cached) return cached;
    try {
      const stored = readLocalState<DocumentImportSession>(`${STORE_PREFIX}${applicationId}`);
      if (stored) this.sessions.set(applicationId, stored);
      return stored;
    } catch {
      return null;
    }
  }

  private storedKeys(): string[] {
    try {
      return listLocalStateKeys(STORE_PREFIX);
    } catch {
      return [];
    }
  }

  private view(session: DocumentImportSession): DocumentImportView {
    return { ...session, files: session.files.map((file) => ({ ...file })), running: this.runners.has(session.applicationId) };
  }
}
