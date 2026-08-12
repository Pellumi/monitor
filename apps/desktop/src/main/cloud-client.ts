import crypto from 'node:crypto';
import os from 'node:os';
import { app, shell } from 'electron';
import type {
  DeclaredFlowDetail,
  DeclaredFlowSummary,
  DesktopApplication,
  DesktopEntitlements,
  QARunSummary,
  QualityReport,
  RepositorySnapshotSummary,
  SourceDocumentManifest,
  SourceDocumentSummary,
  IntentDraft,
  InstrumentationDetection,
  InstrumentationPlan,
  InstrumentationApplyResult,
  InstrumentationValidationResult,
} from '@sots/desktop-contracts';
import type { InstrumentationCheckpoint } from './git-checkpoint';
import type { GuidedRunState } from '@sots/browser-observer';
import { clearDesktopSession, loadDesktopSession, saveDesktopSession, type StoredDesktopSession } from './secure-store';

const API_URL = (process.env.TELLANN_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const AUTH_URL = (process.env.TELLANN_AUTH_URL ?? API_URL).replace(/\/$/, '');

type Json = Record<string, unknown>;

async function jsonRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    });
  } catch (cause) {
    const endpoint = new URL(url).origin;
    const error = new Error(`Tellann cloud is unavailable at ${endpoint}. Check that the API gateway is running, then retry.`);
    Object.assign(error, { code: 'CLOUD_UNAVAILABLE', cause });
    throw error;
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const payload = body as Json | null;
    const error = new Error(String(payload?.message ?? payload?.error ?? `HTTP_${response.status}`));
    Object.assign(error, { status: response.status, code: payload?.error });
    throw error;
  }
  return body as T;
}

type LocalArtifact = {
  name: string;
  filePath: string;
  bytes: number;
  checksum: string;
  type: 'SCREENSHOT' | 'PLAYWRIGHT_TRACE' | 'ACCESSIBILITY_SNAPSHOT';
};

export class DesktopCloudClient {
  private refreshing: Promise<StoredDesktopSession> | null = null;

  getSession() {
    const value = loadDesktopSession();
    return value
      ? { authenticated: true, deviceSessionId: value.deviceSessionId, user: value.user }
      : { authenticated: false, deviceSessionId: null, user: null };
  }

  async signIn(): Promise<ReturnType<DesktopCloudClient['getSession']>> {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const authorization = await jsonRequest<{
      requestToken: string; authorizeUrl: string; expiresAt: string; pollingIntervalSeconds: number;
    }>(`${AUTH_URL}/auth/desktop/authorize`, {
      method: 'POST',
      body: JSON.stringify({
        codeChallenge: challenge,
        deviceIdentifier: this.deviceIdentifier(),
        deviceName: os.hostname(),
        platform: `${process.platform}-${process.arch}`,
        appVersion: app.getVersion(),
        scopes: ['desktop:guided-runs', 'desktop:read-workspace'],
      }),
    });
    await shell.openExternal(authorization.authorizeUrl);
    const deadline = new Date(authorization.expiresAt).getTime();
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, authorization.pollingIntervalSeconds * 1_000));
      try {
        const tokens = await jsonRequest<StoredDesktopSession & { expiresIn: number }>(
          `${AUTH_URL}/auth/desktop/token`,
          { method: 'POST', body: JSON.stringify({ requestToken: authorization.requestToken, codeVerifier: verifier }) },
        );
        saveDesktopSession(tokens);
        return this.getSession();
      } catch (error) {
        if ((error as { status?: number }).status !== 428) throw error;
      }
    }
    throw new Error('DESKTOP_AUTH_REQUEST_EXPIRED');
  }

  async signOut(): Promise<void> {
    const current = loadDesktopSession();
    if (current) {
      await this.request(`/auth/desktop/devices/${current.deviceSessionId}`, { method: 'DELETE' }).catch(() => undefined);
    }
    clearDesktopSession();
  }

  async applications(): Promise<DesktopApplication[]> {
    const apps = await this.request<Array<Json>>('/applications');
    const organizationIds = [...new Set(apps.map((item) => String((item.organization as Json | undefined)?.id ?? item.organizationId)))];
    const entitlementEntries = await Promise.all(organizationIds.map(async (organizationId) => {
      try {
        const entitlement = await this.request<Json>(`/organizations/${organizationId}/entitlement`);
        const features = (entitlement.features as Json | undefined) ?? {};
        const enabled = (feature: string) => features[feature] === true || typeof features[feature] === 'string';
        return [organizationId, {
          planType: String(entitlement.planType) as DesktopEntitlements['planType'],
          features: {
            DESKTOP_GUIDED_RUNS: enabled('DESKTOP_GUIDED_RUNS'),
            DOCUMENT_FLOW_INFERENCE: enabled('DOCUMENT_FLOW_INFERENCE'),
            AUTOMATED_INSTRUMENTATION: enabled('AUTOMATED_INSTRUMENTATION'),
            SHARED_RUN_GOVERNANCE: enabled('SHARED_RUN_GOVERNANCE'),
            BROWSER_TRACE_CAPTURE: enabled('BROWSER_TRACE_CAPTURE'),
            VISUAL_ACCESSIBILITY_ANALYSIS: enabled('VISUAL_ACCESSIBILITY_ANALYSIS'),
          },
        }] as const;
      } catch {
        return [organizationId, null] as const;
      }
    }));
    const entitlements = new Map(entitlementEntries);
    return apps.map((item) => {
      const organizationId = String((item.organization as Json | undefined)?.id ?? item.organizationId);
      return ({
      id: String(item.id),
      name: String(item.name),
      organizationId,
      organizationName: String((item.organization as Json | undefined)?.name ?? 'Organization'),
      entitlements: entitlements.get(organizationId) ?? null,
      environments: ((item.environments as Json[] | undefined) ?? []).map((environment) => ({
        id: String(environment.id),
        name: String(environment.name),
        type: environment.type as DesktopApplication['environments'][number]['type'],
        baseUrl: typeof environment.baseUrl === 'string' ? environment.baseUrl : null,
      })),
      });
    });
  }

  async runs(applicationId: string): Promise<QARunSummary[]> {
    const runs = await this.request<Array<Json>>(`/applications/${applicationId}/qa-runs`);
    return runs.map((run) => {
      const environment = run.environment as Json | undefined;
      const counts = run._count as Json | undefined;
      return {
        id: String(run.id),
        applicationId: String(run.applicationId),
        environmentId: String(run.environmentId),
        workspaceId: typeof run.workspaceId === 'string' ? run.workspaceId : null,
        deviceSessionId: typeof run.deviceSessionId === 'string' ? run.deviceSessionId : null,
        expectedGraphVersionId: typeof run.expectedGraphVersionId === 'string' ? run.expectedGraphVersionId : null,
        mode: run.mode as QARunSummary['mode'],
        status: run.status as QARunSummary['status'],
        targetUrl: String(run.targetUrl),
        startedAt: run.startedAt ? new Date(String(run.startedAt)).toISOString() : null,
        endedAt: run.endedAt ? new Date(String(run.endedAt)).toISOString() : null,
        failureReason: typeof run.failureReasonSafe === 'string' ? run.failureReasonSafe : null,
        createdAt: run.createdAt ? new Date(String(run.createdAt)).toISOString() : undefined,
        updatedAt: run.updatedAt ? new Date(String(run.updatedAt)).toISOString() : undefined,
        environment: environment ? {
          id: String(environment.id),
          name: String(environment.name),
          type: environment.type as DesktopApplication['environments'][number]['type'],
        } : undefined,
        artifactCount: Number(counts?.artifacts ?? 0),
        findingCount: Number(counts?.findings ?? 0),
        reportId: typeof run.reportId === 'string' ? run.reportId : null,
      };
    });
  }

  async run(runId: string): Promise<Json> {
    return this.request<Json>(`/qa-runs/${runId}`);
  }

  async runReport(runId: string): Promise<QualityReport> {
    return this.request<QualityReport>(`/qa-runs/${runId}/report`);
  }

  async declaredFlows(applicationId: string): Promise<DeclaredFlowSummary[]> {
    const flows = await this.request<DeclaredFlowSummary[]>(`/applications/${applicationId}/declared-flow`);
    return Array.isArray(flows) ? flows : [];
  }

  async declaredFlow(applicationId: string, flowId: string): Promise<DeclaredFlowDetail> {
    return this.request<DeclaredFlowDetail>(`/applications/${applicationId}/declared-flow/${flowId}`);
  }

  async createDeclaredFlow(applicationId: string, input: { name: string; workflowType: string }): Promise<DeclaredFlowSummary> {
    return this.request<DeclaredFlowSummary>(`/applications/${applicationId}/declared-flow`, {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  async addDeclaredState(applicationId: string, flowId: string, input: { stateName: string; category: string }): Promise<Json> {
    return this.request<Json>(`/applications/${applicationId}/declared-flow/${flowId}/states`, {
      method: 'POST', body: JSON.stringify({ ...input, provenance: 'USER_DECLARED' }),
    });
  }

  async addDeclaredTransition(applicationId: string, flowId: string, input: { fromStateId: string; toStateId: string; action?: string }): Promise<Json> {
    return this.request<Json>(`/applications/${applicationId}/declared-flow/${flowId}/transitions`, {
      method: 'POST', body: JSON.stringify({ ...input, provenance: 'USER_DECLARED' }),
    });
  }

  async setDeclaredFlowComplete(applicationId: string, flowId: string, complete: boolean): Promise<Json> {
    const action = complete ? 'complete' : 'reopen';
    return this.request<Json>(`/applications/${applicationId}/declared-flow/${flowId}/${action}`, { method: 'POST' });
  }

  async documents(applicationId: string): Promise<SourceDocumentSummary[]> {
    return this.request<SourceDocumentSummary[]>(`/applications/${applicationId}/source-documents`);
  }

  async uploadDerivedDocument(applicationId: string, manifest: SourceDocumentManifest) {
    return this.request<Json>(`/applications/${applicationId}/source-documents/upload-intent`, {
      method: 'POST', body: JSON.stringify({ manifest, fullFileApproved: false }),
    });
  }

  async intentDrafts(applicationId: string): Promise<IntentDraft[]> {
    const response = await this.request<{ success: boolean; data: IntentDraft[] }>(`/v1/applications/${applicationId}/intent-drafts`);
    return response.data;
  }

  async intentDraft(applicationId: string, draftId: string): Promise<IntentDraft> {
    const response = await this.request<{ success: boolean; data: IntentDraft }>(`/v1/applications/${applicationId}/intent-drafts/${draftId}`);
    return response.data;
  }

  async createIntentDraft(applicationId: string, documentVersionIds: string[], repositorySnapshotId?: string | null) {
    return this.request<Json>(`/v1/applications/${applicationId}/intent-drafts`, {
      method: 'POST', body: JSON.stringify({ documentVersionIds, repositorySnapshotId: repositorySnapshotId ?? null }),
    });
  }

  async reviewIntentDraft(applicationId: string, draftId: string, input: Json) {
    return this.request<Json>(`/v1/applications/${applicationId}/intent-drafts/${draftId}/review`, { method: 'POST', body: JSON.stringify(input) });
  }

  async correctIntentDraft(applicationId: string, draftId: string, correction: string) {
    return this.request<Json>(`/v1/applications/${applicationId}/intent-drafts/${draftId}/correct`, { method: 'POST', body: JSON.stringify({ correction }) });
  }

  async registerWorkspace(applicationId: string, opaqueLocalId: string, snapshot: RepositorySnapshotSummary) {
    const workspace = await this.request<Json>(`/applications/${applicationId}/workspaces`, {
      method: 'POST',
      body: JSON.stringify({
        opaqueLocalId,
        repositoryFingerprint: snapshot.repositoryFingerprint,
        detectedStack: snapshot.frameworks,
        packageManager: snapshot.packageManager,
      }),
    });
    const repositorySnapshot = await this.request<Json>(`/applications/${applicationId}/repository-snapshots`, {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: workspace.id,
        revision: snapshot.revision,
        branch: snapshot.branch,
        dirty: snapshot.dirty,
        repositoryFingerprint: snapshot.repositoryFingerprint,
        frameworkSummary: snapshot.frameworks,
        routeSummary: snapshot.routes,
        endpointSummary: snapshot.endpoints,
        documentationSummary: snapshot.documentation,
        manifestHashes: snapshot.manifestHashes,
        scannerVersion: snapshot.scannerVersion,
        redactionSummary: snapshot.redactionSummary,
      }),
    });
    return { workspaceId: String(workspace.id), repositorySnapshotId: String(repositorySnapshot.id) };
  }

  async detectInstrumentation(applicationId: string, input: { workspaceId: string; environmentId: string; detections: InstrumentationDetection[] }) {
    return this.request<{ entitled: boolean; activeControlAllowed: boolean; detections: InstrumentationDetection[] }>(
      `/v1/applications/${applicationId}/instrumentation/detect`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  async createInstrumentationPlan(applicationId: string, input: {
    workspaceId: string;
    repositorySnapshotId: string;
    environmentId: string;
    deviceSessionId: string;
    plan: InstrumentationPlan;
  }): Promise<Json> {
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans`, {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  async instrumentationPlans(applicationId: string): Promise<Json[]> {
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans`);
  }

  async instrumentationPlan(applicationId: string, planId: string): Promise<Json> {
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans/${planId}`);
  }

  async approveInstrumentation(applicationId: string, planId: string, input: { approvedFileScopes: string[]; approvedCommandIds: string[] }): Promise<Json> {
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans/${planId}/approve`, {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  async rejectInstrumentation(applicationId: string, planId: string, reason?: string): Promise<Json> {
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans/${planId}/reject`, {
      method: 'POST', body: JSON.stringify({ reason }),
    });
  }

  async instrumentationApplyIntent(applicationId: string, planId: string) {
    const current = loadDesktopSession();
    if (!current) throw new Error('AUTHENTICATION_REQUIRED');
    return this.request<{ capability: string; expiresInSeconds: number; approvalHash: string }>(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/apply-intent`,
      { method: 'POST', body: JSON.stringify({ deviceSessionId: current.deviceSessionId }) },
    );
  }

  async submitInstrumentationResult(
    applicationId: string,
    planId: string,
    capability: string,
    result: InstrumentationApplyResult,
    validation: InstrumentationValidationResult,
    commandResults: unknown[],
    checkpoint: InstrumentationCheckpoint,
  ): Promise<Json> {
    // Raw diffs and local checkpoint paths stay on-device. The cloud receives
    // only hashes and the bounded file manifest required for governance.
    const cloudResult = {
      planId: result.planId,
      checkpointId: result.checkpointId,
      baseRevision: result.baseRevision,
      files: result.files,
      changedFiles: result.changedFiles,
      diffHash: result.diffHash,
      appliedAt: result.appliedAt,
    };
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans/${planId}/results`, {
      method: 'POST',
      headers: { 'x-tellann-instrumentation-capability': capability },
      body: JSON.stringify({
        result: cloudResult,
        validation,
        commandResults,
        checkpointKind: checkpoint.kind,
        checkpointMetadata: {
          branch: checkpoint.branch,
          previousBranch: checkpoint.previousBranch,
          baseRevision: checkpoint.baseRevision,
          dirty: checkpoint.dirty,
          reason: checkpoint.reason,
          createdAt: checkpoint.createdAt,
        },
      }),
    });
  }

  async failInstrumentation(applicationId: string, planId: string, capability: string, reason: string) {
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans/${planId}/fail`, {
      method: 'POST',
      headers: { 'x-tellann-instrumentation-capability': capability },
      body: JSON.stringify({ reason: reason.slice(0, 1_000) }),
    });
  }

  async instrumentationRollbackIntent(applicationId: string, planId: string) {
    const current = loadDesktopSession();
    if (!current) throw new Error('AUTHENTICATION_REQUIRED');
    return this.request<{ capability: string; patchSetId: string; expiresInSeconds: number }>(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/rollback-intent`,
      { method: 'POST', body: JSON.stringify({ deviceSessionId: current.deviceSessionId }) },
    );
  }

  async submitInstrumentationRollback(applicationId: string, planId: string, patchSetId: string, capability: string, result: unknown) {
    return this.request(`/v1/applications/${applicationId}/instrumentation/plans/${planId}/rollback-results`, {
      method: 'POST',
      headers: { 'x-tellann-instrumentation-capability': capability },
      body: JSON.stringify({ patchSetId, result }),
    });
  }

  async createRun(input: Json) {
    const session = loadDesktopSession();
    return this.request<Json>(`/applications/${input.applicationId}/qa-runs`, {
      method: 'POST',
      body: JSON.stringify({ ...input, deviceSessionId: session?.deviceSessionId }),
    });
  }

  async startRun(runId: string, sessionId: string, traceId: string) {
    const credential = await this.request<{ credential: string; expiresInSeconds: number; runId: string }>(`/qa-runs/${runId}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, traceId }),
    });
    const run = await this.request<Json>(`/qa-runs/${runId}/start`, { method: 'POST' });
    return { run, credential };
  }

  async completeRun(state: GuidedRunState) {
    const artifacts = await this.readManifest(state);
    const uploadedArtifacts: Json[] = [];
    for (const artifact of artifacts) {
      try {
        uploadedArtifacts.push(await this.uploadArtifact(state.runId, artifact));
      } catch (error) {
        if (artifact.type === 'PLAYWRIGHT_TRACE' && (error as { status?: number }).status === 403) continue;
        throw error;
      }
    }
    await this.request(`/qa-runs/${state.runId}/artifacts`, {
      method: 'POST',
      body: JSON.stringify({ artifacts: uploadedArtifacts, findings: state.findings }),
    });
    const completed = await this.request<Json>(`/qa-runs/${state.runId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: state.sessionId,
        traceId: state.traceId,
        observations: state.observations,
        observedTransitions: state.observedTransitions,
      }),
    });
    await this.request(`/applications/${completed.applicationId}/reconciliation/run`, {
      method: 'POST',
      body: JSON.stringify({
        environmentId: completed.environmentId,
        expectedGraphId: completed.expectedGraphVersionId,
        runId: state.runId,
      }),
    });
    return this.request<Json>(`/qa-runs/${state.runId}/report`);
  }

  async failRun(runId: string, reason: string) {
    return this.request(`/qa-runs/${runId}/fail`, {
      method: 'POST',
      body: JSON.stringify({ failureReasonSafe: reason.slice(0, 500) }),
    });
  }

  private async uploadArtifact(runId: string, artifact: LocalArtifact): Promise<Json> {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(artifact.filePath);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.binaryRequest<Json>(
          `/qa-runs/${runId}/artifacts/${artifact.checksum}/content`,
          content,
          {
            'x-tellann-artifact-name': encodeURIComponent(artifact.name),
            'x-tellann-artifact-type': artifact.type,
            'x-tellann-artifact-checksum': artifact.checksum,
            'x-tellann-privacy-classification': 'INTERNAL',
          },
        );
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number }).status;
        if (status && status < 500) throw error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }
    throw lastError;
  }

  private async readManifest(state: GuidedRunState): Promise<LocalArtifact[]> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const manifest = JSON.parse(await fs.readFile(path.join(state.artifactDirectory, 'manifest.json'), 'utf8')) as {
      artifacts: Array<{ name: string; bytes: number; checksum: string }>;
    };
    return manifest.artifacts.map((artifact) => ({
      name: artifact.name,
      filePath: path.join(state.artifactDirectory, artifact.name),
      type: artifact.name === 'final.png' ? 'SCREENSHOT'
        : artifact.name === 'trace.zip' ? 'PLAYWRIGHT_TRACE' : 'ACCESSIBILITY_SNAPSHOT',
      bytes: artifact.bytes,
      checksum: artifact.checksum,
    }));
  }

  private deviceIdentifier(): string {
    return crypto.createHash('sha256').update(`${os.hostname()}:${os.userInfo().username}:${process.arch}`).digest('hex');
  }

  private async refresh(): Promise<StoredDesktopSession> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const current = loadDesktopSession();
        if (!current) throw new Error('AUTHENTICATION_REQUIRED');
        try {
          const tokens = await jsonRequest<{ accessToken: string; refreshToken: string }>(
            `${AUTH_URL}/auth/desktop/refresh`,
            { method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }) },
          );
          const next = { ...current, ...tokens };
          saveDesktopSession(next);
          return next;
        } catch (error) {
          // A rejected refresh is terminal for this device-bound session. Keeping
          // it in secure storage leaves the renderer in a misleading authenticated
          // shell that can never recover. Network failures remain retryable and do
          // not clear the credential.
          if ((error as { status?: number }).status === 401) clearDesktopSession();
          throw error;
        }
      })().finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  }

  private async request<T = unknown>(pathName: string, init: RequestInit = {}, retry = true): Promise<T> {
    const current = loadDesktopSession();
    if (!current) throw new Error('AUTHENTICATION_REQUIRED');
    try {
      return await jsonRequest<T>(`${API_URL}${pathName}`, {
        ...init,
        headers: { ...init.headers, authorization: `Bearer ${current.accessToken}` },
      });
    } catch (error) {
      if (retry && (error as { status?: number }).status === 401) {
        await this.refresh();
        return this.request<T>(pathName, init, false);
      }
      throw error;
    }
  }

  private async binaryRequest<T>(
    pathName: string,
    body: Uint8Array,
    headers: Record<string, string>,
    retry = true,
  ): Promise<T> {
    const current = loadDesktopSession();
    if (!current) throw new Error('AUTHENTICATION_REQUIRED');
    const response = await fetch(`${API_URL}${pathName}`, {
      method: 'POST',
      headers: {
        ...headers,
        authorization: `Bearer ${current.accessToken}`,
        'content-type': 'application/octet-stream',
      },
      body: body as BodyInit,
    });
    const responseBody = response.status === 204 ? null : await response.json().catch(() => null);
    if (response.ok) return responseBody as T;
    if (retry && response.status === 401) {
      await this.refresh();
      return this.binaryRequest(pathName, body, headers, false);
    }
    const error = new Error(String((responseBody as Json | null)?.error ?? `HTTP_${response.status}`));
    Object.assign(error, { status: response.status });
    throw error;
  }
}
