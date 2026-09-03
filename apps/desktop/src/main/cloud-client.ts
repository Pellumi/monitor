import crypto from "node:crypto";
import os from "node:os";
import { app, net, shell } from "electron";
import type {
  BranchPolicy,
  DeclaredFlowDetail,
  DeclaredFlowSummary,
  FlowReviewPreview,
  FlowSuggestionsResponse,
  DesktopApplication,
  DesktopEntitlements,
  QARunSummary,
  QualityReport,
  RepositorySnapshotSummary,
  SourceDocumentManifest,
  DocumentProcessingJob,
  IntentDraftJob,
  IntentDraftJobCreated,
  SourceDocumentSummary,
  IntentDraft,
  InstrumentationDetection,
  InstrumentationPlan,
  InstrumentationApplyResult,
  InstrumentationValidationResult,
} from "@tellann/desktop-contracts";
import type { InstrumentationCheckpoint } from "./git-checkpoint";
import type { GuidedRunState } from "@tellann/browser-observer";
import {
  clearDesktopSession,
  loadDesktopSession,
  saveDesktopSession,
  type StoredDesktopSession,
} from "./secure-store";
import { loadDesktopEnvironment } from "./environment";

loadDesktopEnvironment();

/**
 * All cloud HTTP goes through Electron's `net.fetch` (Chromium network stack)
 * rather than Node's global `fetch` (undici). Chromium has an async DNS
 * resolver with caching + retry that tolerates a flaky local resolver, runs off
 * the JS event loop, and honours system proxy settings — Node's `fetch` collapses
 * DNS + connect + TLS into a single 10s budget that a slow lookup blows through
 * as `UND_ERR_CONNECT_TIMEOUT`.
 */
const cloudFetch: typeof fetch = (input: any, init: any = {}) =>
  net.fetch(input, { credentials: "omit", ...init });

const API_URL = (
  process.env.TELLANN_API_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");
const AUTH_URL = (process.env.TELLANN_AUTH_URL ?? API_URL).replace(/\/$/, "");

type Json = Record<string, unknown>;

function authCancelledError(): Error {
  return Object.assign(new Error("DESKTOP_AUTH_CANCELLED"), {
    code: "DESKTOP_AUTH_CANCELLED",
  });
}

function waitFor(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(authCancelledError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(authCancelledError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function jsonRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  let requestBody = init.body;
  if (requestBody !== undefined) {
    if (!headers["content-type"] && !headers["Content-Type"]) {
      headers["content-type"] = "application/json";
    }
  } else if (method === "POST" || method === "PUT" || method === "PATCH") {
    headers["content-type"] = "application/json";
    requestBody = JSON.stringify({});
  }

  try {
    response = await cloudFetch(url, {
      ...init,
      method,
      headers,
      body: requestBody,
    });
  } catch (cause) {
    const endpoint = new URL(url).origin;
    const error = new Error(
      `Tellann cloud is unavailable at ${endpoint}. Check that the API gateway is running, then retry.`,
    );
    Object.assign(error, { code: "CLOUD_UNAVAILABLE", cause });
    throw error;
  }
  const body =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const payload = body as Json | null;
    const error = new Error(
      String(payload?.message ?? payload?.error ?? `HTTP_${response.status}`),
    );
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    Object.assign(error, {
      status: response.status,
      code: payload?.error,
      retryAfterMs:
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : undefined,
    });
    throw error;
  }
  return body as T;
}

type LocalArtifact = {
  name: string;
  filePath: string;
  bytes: number;
  checksum: string;
  type: "SCREENSHOT" | "PLAYWRIGHT_TRACE" | "ACCESSIBILITY_SNAPSHOT";
};

export class DesktopCloudClient {
  private refreshing: Promise<StoredDesktopSession> | null = null;
  private readonly inflightReads = new Map<string, Promise<unknown>>();
  private readonly readCache = new Map<
    string,
    { value: unknown; cachedAt: number }
  >();
  private rateLimitedUntil = 0;
  private activeSignIn: {
    controller: AbortController;
    authorizeUrl: string | null;
  } | null = null;

  getSession() {
    const value = loadDesktopSession();
    return value
      ? {
          authenticated: true,
          deviceSessionId: value.deviceSessionId,
          user: value.user,
        }
      : { authenticated: false, deviceSessionId: null, user: null };
  }

  localWorkspaceScope(): string | null {
    const session = loadDesktopSession();
    return session ? `${session.user.id}:${this.deviceIdentifier()}` : null;
  }

  /**
   * The signed-in user's avatar as a `data:` URI, so the renderer can show it
   * under its `img-src 'self' data:` CSP without reaching out to the network
   * itself. Resolves uploads, chosen DiceBear avatars and the email-seeded
   * default alike — the auth service's public redirect endpoint does that.
   * Cached briefly; returns null (fall back to initials) on any failure.
   */
  private avatarCache: { userId: string; dataUri: string; cachedAt: number } | null = null;

  async avatarDataUri(): Promise<string | null> {
    const session = loadDesktopSession();
    const userId = session?.user?.id;
    if (!userId) return null;

    if (
      this.avatarCache &&
      this.avatarCache.userId === userId &&
      Date.now() - this.avatarCache.cachedAt < 5 * 60_000
    ) {
      return this.avatarCache.dataUri;
    }

    try {
      const response = await cloudFetch(`${AUTH_URL}/auth/users/${encodeURIComponent(userId)}/avatar`, {
        redirect: "follow",
      });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type")?.split(";")[0].trim() || "image/svg+xml";
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) return null;
      const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;
      this.avatarCache = { userId, dataUri, cachedAt: Date.now() };
      return dataUri;
    } catch {
      return null;
    }
  }

  /** Drop the cached avatar so the next read re-fetches (used after sign-out). */
  clearAvatarCache(): void {
    this.avatarCache = null;
  }

  async signIn(): Promise<ReturnType<DesktopCloudClient["getSession"]>> {
    this.cancelSignIn();
    const controller = new AbortController();
    const attempt = { controller, authorizeUrl: null as string | null };
    this.activeSignIn = attempt;
    try {
      const verifier = crypto.randomBytes(48).toString("base64url");
      const challenge = crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64url");
      const authorization = await jsonRequest<{
        requestToken: string;
        authorizeUrl: string;
        expiresAt: string;
        pollingIntervalSeconds: number;
      }>(`${AUTH_URL}/auth/desktop/authorize`, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          codeChallenge: challenge,
          deviceIdentifier: this.deviceIdentifier(),
          deviceName: os.hostname(),
          platform: `${process.platform}-${process.arch}`,
          appVersion: app.getVersion(),
          scopes: ["desktop:guided-runs", "desktop:read-workspace"],
        }),
      });
      if (controller.signal.aborted) throw authCancelledError();
      attempt.authorizeUrl = authorization.authorizeUrl;
      await shell.openExternal(authorization.authorizeUrl);
      const deadline = new Date(authorization.expiresAt).getTime();
      while (Date.now() < deadline) {
        await waitFor(
          authorization.pollingIntervalSeconds * 1_000,
          controller.signal,
        );
        try {
          const tokens = await jsonRequest<
            StoredDesktopSession & { expiresIn: number }
          >(`${AUTH_URL}/auth/desktop/token`, {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
              requestToken: authorization.requestToken,
              codeVerifier: verifier,
            }),
          });
          saveDesktopSession(tokens);
          return this.getSession();
        } catch (error) {
          if (controller.signal.aborted) throw authCancelledError();
          if ((error as { status?: number }).status !== 428) throw error;
        }
      }
      throw new Error("DESKTOP_AUTH_REQUEST_EXPIRED");
    } catch (error) {
      if (controller.signal.aborted) throw authCancelledError();
      throw error;
    } finally {
      if (this.activeSignIn === attempt) this.activeSignIn = null;
    }
  }

  async reopenSignIn(): Promise<void> {
    const authorizeUrl = this.activeSignIn?.authorizeUrl;
    if (!authorizeUrl) throw new Error("DESKTOP_AUTH_NOT_PENDING");
    await shell.openExternal(authorizeUrl);
  }

  cancelSignIn(): void {
    this.activeSignIn?.controller.abort();
    this.activeSignIn = null;
  }

  async signOut(): Promise<void> {
    const current = loadDesktopSession();
    if (current) {
      await this.request(`/auth/desktop/devices/${current.deviceSessionId}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    clearDesktopSession();
    this.clearAvatarCache();
  }

  async applications(): Promise<DesktopApplication[]> {
    const apps = await this.request<Array<Json>>("/applications");
    const organizationIds = [
      ...new Set(
        apps.map((item) =>
          String(
            (item.organization as Json | undefined)?.id ?? item.organizationId,
          ),
        ),
      ),
    ];
    const entitlementEntries = await Promise.all(
      organizationIds.map(async (organizationId) => {
        try {
          const entitlement = await this.request<Json>(
            `/organizations/${organizationId}/entitlement`,
          );
          const features = (entitlement.features as Json | undefined) ?? {};
          const enabled = (feature: string) =>
            features[feature] === true || typeof features[feature] === "string";
          return [
            organizationId,
            {
              planType: String(
                entitlement.planType,
              ) as DesktopEntitlements["planType"],
              features: {
                DESKTOP_GUIDED_RUNS: enabled("DESKTOP_GUIDED_RUNS"),
                DOCUMENT_FLOW_INFERENCE: enabled("DOCUMENT_FLOW_INFERENCE"),
                AUTOMATED_INSTRUMENTATION: enabled("AUTOMATED_INSTRUMENTATION"),
                SHARED_RUN_GOVERNANCE: enabled("SHARED_RUN_GOVERNANCE"),
                BROWSER_TRACE_CAPTURE: enabled("BROWSER_TRACE_CAPTURE"),
                VISUAL_ACCESSIBILITY_ANALYSIS: enabled(
                  "VISUAL_ACCESSIBILITY_ANALYSIS",
                ),
              },
            },
          ] as const;
        } catch {
          return [organizationId, null] as const;
        }
      }),
    );
    const entitlements = new Map(entitlementEntries);
    return apps.map((item) => {
      const organizationId = String(
        (item.organization as Json | undefined)?.id ?? item.organizationId,
      );
      return {
        id: String(item.id),
        name: String(item.name),
        summary: typeof item.summary === "string" ? item.summary : null,
        organizationId,
        organizationName: String(
          (item.organization as Json | undefined)?.name ?? "Organization",
        ),
        entitlements: entitlements.get(organizationId) ?? null,
        environments: ((item.environments as Json[] | undefined) ?? []).map(
          (environment) => ({
            id: String(environment.id),
            name: String(environment.name),
            type: environment.type as DesktopApplication["environments"][number]["type"],
            baseUrl:
              typeof environment.baseUrl === "string"
                ? environment.baseUrl
                : null,
          }),
        ),
        projectWorkspaces: Array.isArray(item.projectWorkspaces)
          ? (item.projectWorkspaces as any)
          : undefined,
      };
    });
  }

  subscribeToAppEvents(onEvent: (event: any) => void): () => void {
    const controller = new AbortController();
    const url = `${API_URL}/v1/desktop/app-events`;

    void (async () => {
      while (!controller.signal.aborted) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        try {
          const res = await cloudFetch(url, { signal: controller.signal });
          if (!res.ok || !res.body) {
            await res.body?.cancel().catch(() => undefined);
            await waitFor(5000, controller.signal).catch(() => undefined);
            continue;
          }

          reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.action) {
                    onEvent(data);
                  }
                } catch {
                  // Ignore parse error
                }
              }
            }
          }
        } catch {
          if (controller.signal.aborted) break;
          await waitFor(5000, controller.signal).catch(() => undefined);
        } finally {
          // Release the socket before reconnecting so failed attempts don't
          // stack up half-dead connections.
          await reader?.cancel().catch(() => undefined);
        }
      }
    })();

    return () => controller.abort();
  }

  async claimSetupHandoff(handoffToken: string): Promise<Json> {
    const current = loadDesktopSession();
    if (!current) throw new Error("AUTHENTICATION_REQUIRED");
    return this.request("/desktop/setup-handoffs/claim", {
      method: "POST",
      body: JSON.stringify({
        handoffToken,
        deviceSessionId: current.deviceSessionId,
      }),
    });
  }

  async consumeSetupHandoff(handoffId: string): Promise<Json> {
    const current = loadDesktopSession();
    if (!current) throw new Error("AUTHENTICATION_REQUIRED");
    return this.request(`/desktop/setup-handoffs/${handoffId}/consume`, {
      method: "POST",
      body: JSON.stringify({ deviceSessionId: current.deviceSessionId }),
    });
  }

  async sdkSetup(applicationId: string, environmentId: string): Promise<Json> {
    return this.request(
      `/applications/${applicationId}/sdk-setup?environmentId=${encodeURIComponent(environmentId)}`,
    );
  }

  async issueSetupKey(
    applicationId: string,
    environmentId: string,
  ): Promise<{ rawKey: string; keyPrefix: string }> {
    return this.request(`/applications/${applicationId}/sdk-setup/key`, {
      method: "POST",
      body: JSON.stringify({ environmentId }),
    });
  }

  async runs(applicationId: string): Promise<QARunSummary[]> {
    const runs = await this.request<Array<Json>>(
      `/applications/${applicationId}/qa-runs`,
    );
    return runs.map((run) => {
      const environment = run.environment as Json | undefined;
      const counts = run._count as Json | undefined;
      return {
        id: String(run.id),
        applicationId: String(run.applicationId),
        environmentId: String(run.environmentId),
        workspaceId:
          typeof run.workspaceId === "string" ? run.workspaceId : null,
        deviceSessionId:
          typeof run.deviceSessionId === "string" ? run.deviceSessionId : null,
        expectedGraphVersionId:
          typeof run.expectedGraphVersionId === "string"
            ? run.expectedGraphVersionId
            : null,
        flowId: typeof run.flowId === "string" ? run.flowId : null,
        flowBindingId:
          typeof run.flowBindingId === "string" ? run.flowBindingId : null,
        flowInitializationId:
          typeof run.flowInitializationId === "string"
            ? run.flowInitializationId
            : null,
        flowScanId: typeof run.flowScanId === "string" ? run.flowScanId : null,
        flowDriftId:
          typeof run.flowDriftId === "string" ? run.flowDriftId : null,
        captureTracks: Array.isArray(run.captureTracks)
          ? (run.captureTracks as QARunSummary["captureTracks"])
          : ["FRONTEND"],
        initialStateKey:
          typeof run.initialStateKey === "string" ? run.initialStateKey : null,
        terminalStateKeys: Array.isArray(run.terminalStateKeys)
          ? run.terminalStateKeys.map(String)
          : [],
        lastObservedStateKey:
          typeof run.lastObservedStateKey === "string"
            ? run.lastObservedStateKey
            : null,
        boundaryStartedAt: run.boundaryStartedAt
          ? new Date(String(run.boundaryStartedAt)).toISOString()
          : null,
        boundaryCompletedAt: run.boundaryCompletedAt
          ? new Date(String(run.boundaryCompletedAt)).toISOString()
          : null,
        completionReason:
          typeof run.completionReason === "string"
            ? run.completionReason
            : null,
        mode: run.mode as QARunSummary["mode"],
        status: run.status as QARunSummary["status"],
        targetUrl: String(run.targetUrl),
        startedAt: run.startedAt
          ? new Date(String(run.startedAt)).toISOString()
          : null,
        endedAt: run.endedAt
          ? new Date(String(run.endedAt)).toISOString()
          : null,
        failureReason:
          typeof run.failureReasonSafe === "string"
            ? run.failureReasonSafe
            : null,
        createdAt: run.createdAt
          ? new Date(String(run.createdAt)).toISOString()
          : undefined,
        updatedAt: run.updatedAt
          ? new Date(String(run.updatedAt)).toISOString()
          : undefined,
        environment: environment
          ? {
              id: String(environment.id),
              name: String(environment.name),
              type: environment.type as DesktopApplication["environments"][number]["type"],
            }
          : undefined,
        artifactCount: Number(counts?.artifacts ?? 0),
        findingCount: Number(counts?.findings ?? 0),
        reportId: typeof run.reportId === "string" ? run.reportId : null,
      };
    });
  }

  async run(runId: string): Promise<Json> {
    return this.request<Json>(`/qa-runs/${runId}`);
  }

  async runReplay(runId: string): Promise<Json> {
    return this.request<Json>(`/qa-runs/${runId}/replay`);
  }

  async runReport(runId: string): Promise<QualityReport> {
    return this.request<QualityReport>(`/qa-runs/${runId}/report`);
  }

  async declaredFlows(applicationId: string): Promise<DeclaredFlowSummary[]> {
    const flows = await this.request<DeclaredFlowSummary[]>(
      `/v1/applications/${applicationId}/flows`,
    );
    return Array.isArray(flows) ? flows : [];
  }

  async declaredFlow(
    applicationId: string,
    flowId: string,
  ): Promise<DeclaredFlowDetail> {
    return this.request<DeclaredFlowDetail>(
      `/v1/applications/${applicationId}/flows/${flowId}`,
    );
  }

  async createDeclaredFlow(
    applicationId: string,
    input: {
      name: string;
      workflowType: string;
      purpose?: string;
      scopeStatement: string;
      exclusions?: string[];
      tags?: string[];
    },
  ): Promise<DeclaredFlowSummary> {
    return this.request<DeclaredFlowSummary>(
      `/v1/applications/${applicationId}/flows`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async addDeclaredState(
    applicationId: string,
    flowId: string,
    input: {
      stateName: string;
      category: string;
      role?: string;
      terminalKind?: string | null;
    },
  ): Promise<Json> {
    return this.request<Json>(
      `/applications/${applicationId}/declared-flow/${flowId}/states`,
      {
        method: "POST",
        body: JSON.stringify({ ...input, provenance: "USER_DECLARED" }),
      },
    );
  }

  async updateDeclaredState(
    applicationId: string,
    flowId: string,
    stateId: string,
    input: {
      stateName: string;
      category: string;
      role?: string;
      terminalKind?: string | null;
    },
  ): Promise<Json> {
    return this.request(
      `/applications/${applicationId}/declared-flow/${flowId}/states/${stateId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
  }

  async deleteDeclaredState(
    applicationId: string,
    flowId: string,
    stateId: string,
  ): Promise<Json> {
    return this.request(
      `/applications/${applicationId}/declared-flow/${flowId}/states/${stateId}`,
      { method: "DELETE" },
    );
  }

  async addDeclaredTransition(
    applicationId: string,
    flowId: string,
    input: { fromStateId: string; toStateId: string; action?: string },
  ): Promise<Json> {
    return this.request<Json>(
      `/applications/${applicationId}/declared-flow/${flowId}/transitions`,
      {
        method: "POST",
        body: JSON.stringify({ ...input, provenance: "USER_DECLARED" }),
      },
    );
  }

  async generateFlowSuggestions(
    applicationId: string,
    flowId: string,
    input: Json,
  ): Promise<FlowSuggestionsResponse> {
    const response = await this.request<{
      success: boolean;
      data: FlowSuggestionsResponse;
    }>(
      `/v1/applications/${applicationId}/declared-flows/${flowId}/suggestions/generate`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return response.data;
  }

  async flowSuggestions(
    applicationId: string,
    flowId: string,
  ): Promise<FlowSuggestionsResponse> {
    const response = await this.request<{
      success: boolean;
      data: FlowSuggestionsResponse;
    }>(
      `/v1/applications/${applicationId}/declared-flows/${flowId}/suggestions`,
    );
    return response.data;
  }

  async acceptFlowSuggestion(
    applicationId: string,
    flowId: string,
    suggestionId: string,
  ): Promise<Json> {
    return this.request(
      `/v1/applications/${applicationId}/declared-flows/${flowId}/suggestions/${suggestionId}/accept`,
      { method: "POST", body: JSON.stringify({}) },
    );
  }

  async rejectFlowSuggestion(
    applicationId: string,
    flowId: string,
    suggestionId: string,
  ): Promise<Json> {
    return this.request(
      `/v1/applications/${applicationId}/declared-flows/${flowId}/suggestions/${suggestionId}/reject`,
      { method: "POST", body: JSON.stringify({}) },
    );
  }

  async previewFlowReview(
    applicationId: string,
    flowId: string,
    input: Json,
  ): Promise<FlowReviewPreview> {
    const response = await this.request<{
      success: boolean;
      data: FlowReviewPreview;
    }>(
      `/v1/applications/${applicationId}/declared-flows/${flowId}/suggestions/preview`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return response.data;
  }

  async applyFlowReview(
    applicationId: string,
    flowId: string,
    input: Json,
  ): Promise<Json> {
    const response = await this.request<{ success: boolean; data: Json }>(
      `/v1/applications/${applicationId}/declared-flows/${flowId}/suggestions/apply-selected`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return response.data;
  }

  async declineFlowReview(
    applicationId: string,
    flowId: string,
    reviewId: string,
  ): Promise<Json> {
    const response = await this.request<{ success: boolean; data: Json }>(
      `/v1/applications/${applicationId}/declared-flows/${flowId}/suggestions/decline-review`,
      { method: "POST", body: JSON.stringify({ reviewId }) },
    );
    return response.data;
  }

  async setDeclaredFlowComplete(
    applicationId: string,
    flowId: string,
    complete: boolean,
  ): Promise<Json> {
    if (complete)
      return this.request<Json>(
        `/v1/applications/${applicationId}/flows/${flowId}/publish`,
        { method: "POST", body: JSON.stringify({}) },
      );
    const flow = await this.declaredFlow(applicationId, flowId);
    const versionId = flow.publishedVersionId ?? flow.versions?.[0]?.id;
    if (!versionId) throw new Error("PUBLISHED_FLOW_VERSION_REQUIRED");
    return this.request<Json>(
      `/v1/applications/${applicationId}/flows/${flowId}/versions/${versionId}/revise`,
      { method: "POST", body: JSON.stringify({}) },
    );
  }

  async flowDiagrams(
    applicationId: string,
    flowId: string,
    versionId: string,
  ): Promise<Json> {
    return this.request(
      `/v1/applications/${applicationId}/flows/${flowId}/versions/${versionId}/diagrams`,
    );
  }

  async initializeFlow(flowId: string, input: Json): Promise<Json> {
    return this.request(`/flows/${flowId}/initializations`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async flowInitialization(initializationId: string): Promise<Json> {
    return this.request(`/flow-initializations/${initializationId}`);
  }

  async analyzeFlowInitialization(initializationId: string): Promise<Json> {
    return this.request(`/flow-initializations/${initializationId}/analyze`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async setFlowInitializationMode(
    initializationId: string,
    mode: "AUTOMATED" | "MANUAL",
  ): Promise<Json> {
    return this.request(`/flow-initializations/${initializationId}/mode`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
  }

  async updateFlowRoadmapStep(
    initializationId: string,
    stepId: string,
    completed: boolean,
  ): Promise<Json> {
    return this.request(
      `/flow-initializations/${initializationId}/roadmap/${encodeURIComponent(stepId)}/progress`,
      { method: "POST", body: JSON.stringify({ completed }) },
    );
  }

  async startFlowVerification(initializationId: string): Promise<Json> {
    return this.request(
      `/flow-initializations/${initializationId}/verification/start`,
      { method: "POST", body: JSON.stringify({}) },
    );
  }

  async flowVerification(initializationId: string): Promise<Json> {
    return this.request(
      `/flow-initializations/${initializationId}/verification`,
    );
  }

  async approveFlowInitialization(
    initializationId: string,
    instrumentationPlanId: string,
  ): Promise<Json> {
    return this.request(`/flow-initializations/${initializationId}/approve`, {
      method: "POST",
      body: JSON.stringify({ instrumentationPlanId }),
    });
  }

  async applyFlowInitialization(
    initializationId: string,
    patchSetId: string,
  ): Promise<Json> {
    return this.request(`/flow-initializations/${initializationId}/apply`, {
      method: "POST",
      body: JSON.stringify({ patchSetId }),
    });
  }

  async validateFlowInitialization(
    initializationId: string,
    input: Json,
  ): Promise<Json> {
    return this.request(`/flow-initializations/${initializationId}/validate`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async rescanFlow(
    bindingId: string,
    repositorySnapshotId: string,
  ): Promise<Json> {
    return this.request(`/flow-bindings/${bindingId}/rescans`, {
      method: "POST",
      body: JSON.stringify({ repositorySnapshotId }),
    });
  }

  async boundaryEvent(runId: string, input: Json): Promise<Json> {
    return this.request(`/qa-runs/${runId}/boundary-events`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async documents(applicationId: string): Promise<SourceDocumentSummary[]> {
    return this.request<SourceDocumentSummary[]>(
      `/applications/${applicationId}/source-documents`,
    );
  }

  async uploadDerivedDocument(
    applicationId: string,
    manifest: SourceDocumentManifest,
  ) {
    return this.request<Json>(
      `/applications/${applicationId}/source-documents/upload-intent`,
      {
        method: "POST",
        body: JSON.stringify({ manifest, fullFileApproved: false }),
      },
    );
  }

  async documentJob(
    applicationId: string,
    jobId: string,
  ): Promise<DocumentProcessingJob> {
    return this.request<DocumentProcessingJob>(
      `/applications/${applicationId}/source-documents/jobs/${jobId}`,
    );
  }

  async intentDrafts(applicationId: string): Promise<IntentDraft[]> {
    const response = await this.request<{
      success: boolean;
      data: IntentDraft[];
    }>(`/v1/applications/${applicationId}/intent-drafts`);
    return response.data;
  }

  async intentDraft(
    applicationId: string,
    draftId: string,
  ): Promise<IntentDraft> {
    const response = await this.request<{
      success: boolean;
      data: IntentDraft;
    }>(`/v1/applications/${applicationId}/intent-drafts/${draftId}`);
    return response.data;
  }

  async createIntentDraft(
    applicationId: string,
    documentVersionIds: string[],
    repositorySnapshotId?: string | null,
  ): Promise<IntentDraftJobCreated> {
    const response = await this.request<{
      success: boolean;
      data: IntentDraftJobCreated;
    }>(`/v1/applications/${applicationId}/intent-drafts`, {
      method: "POST",
      body: JSON.stringify({
        documentVersionIds,
        repositorySnapshotId: repositorySnapshotId ?? null,
      }),
    });
    return response.data;
  }

  async intentDraftJob(
    applicationId: string,
    jobId: string,
  ): Promise<IntentDraftJob> {
    const response = await this.request<{
      success: boolean;
      data: IntentDraftJob;
    }>(`/v1/applications/${applicationId}/intent-drafts/jobs/${jobId}`);
    return response.data;
  }

  async intentDraftJobs(applicationId: string): Promise<IntentDraftJob[]> {
    const response = await this.request<{
      success: boolean;
      data: IntentDraftJob[];
    }>(`/v1/applications/${applicationId}/intent-drafts/jobs`);
    return response.data;
  }

  async cancelIntentDraftJob(
    applicationId: string,
    jobId: string,
  ): Promise<IntentDraftJob> {
    const response = await this.request<{
      success: boolean;
      data: IntentDraftJob;
    }>(`/v1/applications/${applicationId}/intent-drafts/jobs/${jobId}/cancel`, {
      method: "POST",
    });
    return response.data;
  }

  async reviewIntentDraft(applicationId: string, draftId: string, input: Json) {
    return this.request<Json>(
      `/v1/applications/${applicationId}/intent-drafts/${draftId}/review`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  async deleteIntentDraft(
    applicationId: string,
    draftId: string,
  ): Promise<void> {
    await this.request<Json>(
      `/v1/applications/${applicationId}/intent-drafts/${draftId}`,
      { method: "DELETE" },
    );
  }

  async correctIntentDraft(
    applicationId: string,
    draftId: string,
    correction: string,
  ): Promise<IntentDraftJobCreated> {
    const response = await this.request<{
      success: boolean;
      data: IntentDraftJobCreated;
    }>(`/v1/applications/${applicationId}/intent-drafts/${draftId}/correct`, {
      method: "POST",
      body: JSON.stringify({ correction }),
    });
    return response.data;
  }

  /** Every workspace attached to this application, including other members'. */
  async workspaces(applicationId: string): Promise<
    Array<{
      id: string;
      createdByUserId?: string;
      isMine?: boolean;
      permissions?: Array<{
        permissionType: string;
        revokedAt: string | null;
        expiresAt: string | null;
      }>;
    }>
  > {
    return this.request(`/applications/${applicationId}/workspaces`);
  }

  /** The QA branch policy this application's members are all measured against. */
  async branchPolicy(applicationId: string): Promise<BranchPolicy> {
    return this.request<BranchPolicy>(
      `/applications/${applicationId}/branch-policy`,
    );
  }

  /**
   * Owner/Admin only. Turns agent-performed branch switching on or off for the
   * whole application. The server rejects the call for regular members.
   */
  async setBranchAgentCheckout(
    applicationId: string,
    allowAgentCheckout: boolean,
  ): Promise<BranchPolicy> {
    return this.request<BranchPolicy>(
      `/applications/${applicationId}/branch-policy`,
      {
        method: "PUT",
        body: JSON.stringify({ allowAgentCheckout }),
      },
    );
  }

  async grantQaBranchCheckout(
    applicationId: string,
    workspaceId: string,
    expiresInMinutes?: number,
  ) {
    return this.request<Json>(
      `/applications/${applicationId}/workspaces/${workspaceId}/qa-branch-grant`,
      { method: "POST", body: JSON.stringify({ expiresInMinutes }) },
    );
  }

  async revokeQaBranchCheckout(applicationId: string, workspaceId: string) {
    return this.request<Json>(
      `/applications/${applicationId}/workspaces/${workspaceId}/qa-branch-grant`,
      { method: "DELETE" },
    );
  }

  async registerWorkspace(
    applicationId: string,
    opaqueLocalId: string,
    snapshot: RepositorySnapshotSummary,
  ) {
    const workspace = await this.request<Json>(
      `/applications/${applicationId}/workspaces`,
      {
        method: "POST",
        body: JSON.stringify({
          opaqueLocalId,
          repositoryFingerprint: snapshot.repositoryFingerprint,
          // Stable across commits, unlike repositoryFingerprint, so the cloud can
          // recognise a teammate's checkout of the same repository.
          portableManifestIdentity: snapshot.portableManifestIdentity,
          repositoryOriginHash: snapshot.repositoryOriginHash,
          repositoryCloneUrl: snapshot.repositoryCloneUrl,
          detectedStack: snapshot.frameworks,
          packageManager: snapshot.packageManager,
        }),
      },
    );
    const repositorySnapshot = await this.request<Json>(
      `/applications/${applicationId}/repository-snapshots`,
      {
        method: "POST",
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
          upstreamBranch: snapshot.upstreamBranch,
          aheadCount: snapshot.aheadCount,
          behindCount: snapshot.behindCount,
        }),
      },
    );
    return {
      workspaceId: String(workspace.id),
      repositorySnapshotId: String(repositorySnapshot.id),
      branchPolicy:
        (workspace as { branchPolicy?: BranchPolicy }).branchPolicy ?? null,
    };
  }

  async detectInstrumentation(
    applicationId: string,
    input: {
      workspaceId: string;
      environmentId: string;
      detections: InstrumentationDetection[];
    },
  ) {
    return this.request<{
      entitled: boolean;
      activeControlAllowed: boolean;
      detections: InstrumentationDetection[];
    }>(`/v1/applications/${applicationId}/instrumentation/detect`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async createInstrumentationPlan(
    applicationId: string,
    input: {
      workspaceId: string;
      repositorySnapshotId: string;
      environmentId: string;
      deviceSessionId: string;
      plan: InstrumentationPlan;
    },
  ): Promise<Json> {
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async instrumentationPlans(applicationId: string): Promise<Json[]> {
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans`,
    );
  }

  async instrumentationPlan(
    applicationId: string,
    planId: string,
  ): Promise<Json> {
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}`,
    );
  }

  async approveInstrumentation(
    applicationId: string,
    planId: string,
    input: { approvedFileScopes: string[]; approvedCommandIds: string[] },
  ): Promise<Json> {
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/approve`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async rejectInstrumentation(
    applicationId: string,
    planId: string,
    reason?: string,
  ): Promise<Json> {
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
  }

  async instrumentationApplyIntent(applicationId: string, planId: string) {
    const current = loadDesktopSession();
    if (!current) throw new Error("AUTHENTICATION_REQUIRED");
    return this.request<{
      capability: string;
      expiresInSeconds: number;
      approvalHash: string;
    }>(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/apply-intent`,
      {
        method: "POST",
        body: JSON.stringify({ deviceSessionId: current.deviceSessionId }),
      },
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
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/results`,
      {
        method: "POST",
        headers: { "x-tellann-instrumentation-capability": capability },
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
      },
    );
  }

  async revalidateInstrumentation(
    applicationId: string,
    planId: string,
    input: {
      checkpointId: string;
      diffHash: string;
      validation: InstrumentationValidationResult;
      commandResults: unknown[];
    },
  ) {
    const current = loadDesktopSession();
    if (!current) throw new Error("AUTHENTICATION_REQUIRED");
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/revalidate`,
      {
        method: "POST",
        body: JSON.stringify({
          ...input,
          deviceSessionId: current.deviceSessionId,
        }),
      },
    );
  }

  async failInstrumentation(
    applicationId: string,
    planId: string,
    capability: string,
    reason: string,
  ) {
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/fail`,
      {
        method: "POST",
        headers: { "x-tellann-instrumentation-capability": capability },
        body: JSON.stringify({ reason: reason.slice(0, 1_000) }),
      },
    );
  }

  async instrumentationRollbackIntent(applicationId: string, planId: string) {
    const current = loadDesktopSession();
    if (!current) throw new Error("AUTHENTICATION_REQUIRED");
    return this.request<{
      capability: string;
      patchSetId: string;
      expiresInSeconds: number;
    }>(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/rollback-intent`,
      {
        method: "POST",
        body: JSON.stringify({ deviceSessionId: current.deviceSessionId }),
      },
    );
  }

  async submitInstrumentationRollback(
    applicationId: string,
    planId: string,
    patchSetId: string,
    capability: string,
    result: unknown,
  ) {
    return this.request(
      `/v1/applications/${applicationId}/instrumentation/plans/${planId}/rollback-results`,
      {
        method: "POST",
        headers: { "x-tellann-instrumentation-capability": capability },
        body: JSON.stringify({ patchSetId, result }),
      },
    );
  }

  async createRun(input: Json) {
    const session = loadDesktopSession();
    return this.request<Json>(`/applications/${input.applicationId}/qa-runs`, {
      method: "POST",
      body: JSON.stringify({
        ...input,
        deviceSessionId: session?.deviceSessionId,
      }),
    });
  }

  async startRun(runId: string, sessionId: string, traceId: string) {
    const credential = await this.request<{
      credential: string;
      expiresInSeconds: number;
      runId: string;
    }>(`/qa-runs/${runId}/credentials`, {
      method: "POST",
      body: JSON.stringify({ sessionId, traceId }),
    });
    const run = await this.request<Json>(`/qa-runs/${runId}/start`, {
      method: "POST",
    });
    return { run, credential };
  }

  async completeRun(state: GuidedRunState & { completionReason?: string }) {
    const artifacts = await this.readManifest(state);
    const uploadedArtifacts: Json[] = [];
    for (const artifact of artifacts) {
      try {
        uploadedArtifacts.push(
          await this.uploadArtifact(state.runId, artifact),
        );
      } catch (error) {
        if (
          artifact.type === "PLAYWRIGHT_TRACE" &&
          (error as { status?: number }).status === 403
        )
          continue;
        throw error;
      }
    }
    await this.request(`/qa-runs/${state.runId}/artifacts`, {
      method: "POST",
      body: JSON.stringify({
        artifacts: uploadedArtifacts,
        findings: state.findings,
      }),
    });
    const completed = await this.request<Json>(
      `/qa-runs/${state.runId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({
          sessionId: state.sessionId,
          traceId: state.traceId,
          observations: state.observations,
          observedTransitions: state.observedTransitions,
          completionReason: state.completionReason,
        }),
      },
    );
    await this.request(
      `/applications/${completed.applicationId}/reconciliation/run`,
      {
        method: "POST",
        body: JSON.stringify({
          environmentId: completed.environmentId,
          expectedGraphId: completed.expectedGraphVersionId,
          runId: state.runId,
        }),
      },
    );
    return this.request<Json>(`/qa-runs/${state.runId}/report`);
  }

  async failRun(runId: string, reason: string) {
    return this.request(`/qa-runs/${runId}/fail`, {
      method: "POST",
      body: JSON.stringify({ failureReasonSafe: reason.slice(0, 500) }),
    });
  }

  private async uploadArtifact(
    runId: string,
    artifact: LocalArtifact,
  ): Promise<Json> {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(artifact.filePath);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.binaryRequest<Json>(
          `/qa-runs/${runId}/artifacts/${artifact.checksum}/content`,
          content,
          {
            "x-tellann-artifact-name": encodeURIComponent(artifact.name),
            "x-tellann-artifact-type": artifact.type,
            "x-tellann-artifact-checksum": artifact.checksum,
            "x-tellann-privacy-classification": "INTERNAL",
          },
        );
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number }).status;
        if (status && status < 500) throw error;
        if (attempt < 3)
          await new Promise((resolve) =>
            setTimeout(resolve, 250 * 2 ** (attempt - 1)),
          );
      }
    }
    throw lastError;
  }

  private async readManifest(state: GuidedRunState): Promise<LocalArtifact[]> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(state.artifactDirectory, "manifest.json"),
        "utf8",
      ),
    ) as {
      artifacts: Array<{ name: string; bytes: number; checksum: string }>;
    };
    return manifest.artifacts.map((artifact) => ({
      name: artifact.name,
      filePath: path.join(state.artifactDirectory, artifact.name),
      type:
        artifact.name === "final.png"
          ? "SCREENSHOT"
          : artifact.name === "trace.zip"
            ? "PLAYWRIGHT_TRACE"
            : "ACCESSIBILITY_SNAPSHOT",
      bytes: artifact.bytes,
      checksum: artifact.checksum,
    }));
  }

  private deviceIdentifier(): string {
    return crypto
      .createHash("sha256")
      .update(`${os.hostname()}:${os.userInfo().username}:${process.arch}`)
      .digest("hex");
  }

  private async refresh(): Promise<StoredDesktopSession> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const current = loadDesktopSession();
        if (!current) throw new Error("AUTHENTICATION_REQUIRED");
        try {
          const tokens = await jsonRequest<{
            accessToken: string;
            refreshToken: string;
          }>(`${AUTH_URL}/auth/desktop/refresh`, {
            method: "POST",
            body: JSON.stringify({ refreshToken: current.refreshToken }),
          });
          const next = { ...current, ...tokens };
          saveDesktopSession(next);
          return next;
        } catch (error) {
          // A rejected refresh is terminal for this device-bound session. Keeping
          // it in secure storage leaves the renderer in a misleading authenticated
          // shell that can never recover. Network failures remain retryable and do
          // not clear the credential.
          if ((error as { status?: number }).status === 401)
            clearDesktopSession();
          throw error;
        }
      })().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async request<T = unknown>(
    pathName: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const method = String(init.method ?? "GET").toUpperCase();
    if (method !== "GET") {
      this.readCache.clear();
      return this.requestOnce<T>(pathName, init, retry);
    }
    const cached = this.readCache.get(pathName);
    if (Date.now() < this.rateLimitedUntil) {
      if (cached) return cached.value as T;
      const seconds = Math.max(
        1,
        Math.ceil((this.rateLimitedUntil - Date.now()) / 1_000),
      );
      const error = new Error(
        `Tellann is temporarily limiting requests. Existing data remains available; retry in ${seconds} seconds.`,
      );
      Object.assign(error, {
        status: 429,
        code: "RATE_LIMITED",
        retryAfterMs: seconds * 1_000,
      });
      throw error;
    }
    if (cached && Date.now() - cached.cachedAt < 2_000)
      return cached.value as T;
    const existing = this.inflightReads.get(pathName);
    if (existing) return existing as Promise<T>;
    const pending = this.requestOnce<T>(pathName, init, retry)
      .then((value) => {
        this.readCache.set(pathName, { value, cachedAt: Date.now() });
        return value;
      })
      .catch((error) => {
        if ((error as { status?: number }).status === 429) {
          const retryAfterMs =
            (error as { retryAfterMs?: number }).retryAfterMs ?? 60_000;
          this.rateLimitedUntil = Date.now() + retryAfterMs;
          if (cached) return cached.value as T;
        }
        throw error;
      })
      .finally(() => this.inflightReads.delete(pathName));
    this.inflightReads.set(pathName, pending);
    return pending;
  }

  private async requestOnce<T = unknown>(
    pathName: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const current = loadDesktopSession();
    if (!current) throw new Error("AUTHENTICATION_REQUIRED");
    try {
      return await jsonRequest<T>(`${API_URL}${pathName}`, {
        ...init,
        headers: {
          ...init.headers,
          authorization: `Bearer ${current.accessToken}`,
        },
      });
    } catch (error) {
      if (retry && (error as { status?: number }).status === 401) {
        await this.refresh();
        return this.requestOnce<T>(pathName, init, false);
      }
      if ((error as { status?: number }).status === 401) {
        clearDesktopSession();
        const expired = new Error(
          "Your Tellann Desktop session expired or was revoked. Sign in again.",
        );
        Object.assign(expired, {
          status: 401,
          code: "DESKTOP_SESSION_INVALID",
          cause: error,
        });
        throw expired;
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
    if (!current) throw new Error("AUTHENTICATION_REQUIRED");
    const response = await cloudFetch(`${API_URL}${pathName}`, {
      method: "POST",
      headers: {
        ...headers,
        authorization: `Bearer ${current.accessToken}`,
        "content-type": "application/octet-stream",
      },
      body: body as BodyInit,
    });
    const responseBody =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (response.ok) return responseBody as T;
    if (retry && response.status === 401) {
      await this.refresh();
      return this.binaryRequest(pathName, body, headers, false);
    }
    const error = new Error(
      String((responseBody as Json | null)?.error ?? `HTTP_${response.status}`),
    );
    Object.assign(error, { status: response.status });
    throw error;
  }
}
