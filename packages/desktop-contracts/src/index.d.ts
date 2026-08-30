import { z } from 'zod';
export declare const DESKTOP_CONTRACT_VERSION = "1.0";
export declare const EnvironmentTypeSchema: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
export declare const PermissionTypeSchema: z.ZodEnum<["BROWSER_ONLY", "READ_WORKSPACE", "PROPOSE_INSTRUMENTATION", "APPLY_TASK", "RUN_COMMANDS", "SENSITIVE_BROWSER_ACTIONS"]>;
export declare const RunStatusSchema: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
export declare const ArtifactTypeSchema: z.ZodEnum<["SCREENSHOT", "PLAYWRIGHT_TRACE", "ACCESSIBILITY_SNAPSHOT", "CONSOLE_LOG", "NETWORK_LOG", "RUN_MANIFEST"]>;
export declare const PrivacyClassificationSchema: z.ZodEnum<["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"]>;
export declare const DesktopDeviceSchema: z.ZodObject<{
    id: z.ZodString;
    deviceName: z.ZodString;
    platform: z.ZodString;
    appVersion: z.ZodString;
    scopes: z.ZodArray<z.ZodString, "many">;
    lastSeenAt: z.ZodString;
    revokedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    deviceName: string;
    platform: string;
    appVersion: string;
    scopes: string[];
    lastSeenAt: string;
    revokedAt: string | null;
}, {
    id: string;
    deviceName: string;
    platform: string;
    appVersion: string;
    scopes: string[];
    lastSeenAt: string;
    revokedAt: string | null;
}>;
export declare const DesktopPermissionSchema: z.ZodObject<{
    type: z.ZodEnum<["BROWSER_ONLY", "READ_WORKSPACE", "PROPOSE_INSTRUMENTATION", "APPLY_TASK", "RUN_COMMANDS", "SENSITIVE_BROWSER_ACTIONS"]>;
    workspaceId: z.ZodOptional<z.ZodString>;
    fileScopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    commandScopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    purpose: z.ZodString;
    expiresAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "BROWSER_ONLY" | "READ_WORKSPACE" | "PROPOSE_INSTRUMENTATION" | "APPLY_TASK" | "RUN_COMMANDS" | "SENSITIVE_BROWSER_ACTIONS";
    fileScopes: string[];
    commandScopes: string[];
    purpose: string;
    expiresAt: string | null;
    workspaceId?: string | undefined;
}, {
    type: "BROWSER_ONLY" | "READ_WORKSPACE" | "PROPOSE_INSTRUMENTATION" | "APPLY_TASK" | "RUN_COMMANDS" | "SENSITIVE_BROWSER_ACTIONS";
    purpose: string;
    workspaceId?: string | undefined;
    fileScopes?: string[] | undefined;
    commandScopes?: string[] | undefined;
    expiresAt?: string | null | undefined;
}>;
export declare const FrameworkEvidenceSchema: z.ZodObject<{
    framework: z.ZodString;
    version: z.ZodNullable<z.ZodString>;
    confidence: z.ZodNumber;
    evidence: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    framework: string;
    version: string | null;
    confidence: number;
    evidence: string[];
}, {
    framework: string;
    version: string | null;
    confidence: number;
    evidence: string[];
}>;
export declare const RepositorySnapshotSummarySchema: z.ZodObject<{
    workspaceId: z.ZodString;
    revision: z.ZodNullable<z.ZodString>;
    branch: z.ZodNullable<z.ZodString>;
    dirty: z.ZodBoolean;
    repositoryFingerprint: z.ZodString;
    repositoryOriginHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    repositoryCloneUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    languages: z.ZodArray<z.ZodString, "many">;
    packageManager: z.ZodNullable<z.ZodString>;
    launchCommands: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        executable: z.ZodString;
        args: z.ZodArray<z.ZodString, "many">;
        cwd: z.ZodString;
        scriptName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        executable: string;
        args: string[];
        cwd: string;
        scriptName: string;
    }, {
        id: string;
        label: string;
        executable: string;
        args: string[];
        cwd: string;
        scriptName: string;
    }>, "many">>;
    suggestedApplicationUrls: z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        confidence: z.ZodNumber;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        url: string;
        source: string;
    }, {
        confidence: number;
        url: string;
        source: string;
    }>, "many">>;
    frameworks: z.ZodArray<z.ZodObject<{
        framework: z.ZodString;
        version: z.ZodNullable<z.ZodString>;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        framework: string;
        version: string | null;
        confidence: number;
        evidence: string[];
    }, {
        framework: string;
        version: string | null;
        confidence: number;
        evidence: string[];
    }>, "many">;
    routes: z.ZodArray<z.ZodString, "many">;
    endpoints: z.ZodArray<z.ZodString, "many">;
    documentation: z.ZodArray<z.ZodString, "many">;
    manifestHashes: z.ZodRecord<z.ZodString, z.ZodString>;
    scannerVersion: z.ZodString;
    redactionSummary: z.ZodObject<{
        excludedFiles: z.ZodNumber;
        suspectedSecrets: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        excludedFiles: number;
        suspectedSecrets: number;
    }, {
        excludedFiles: number;
        suspectedSecrets: number;
    }>;
}, "strip", z.ZodTypeAny, {
    dirty: boolean;
    workspaceId: string;
    revision: string | null;
    branch: string | null;
    repositoryFingerprint: string;
    languages: string[];
    packageManager: string | null;
    frameworks: {
        framework: string;
        version: string | null;
        confidence: number;
        evidence: string[];
    }[];
    routes: string[];
    endpoints: string[];
    documentation: string[];
    manifestHashes: Record<string, string>;
    scannerVersion: string;
    redactionSummary: {
        excludedFiles: number;
        suspectedSecrets: number;
    };
    repositoryOriginHash?: string | null | undefined;
    repositoryCloneUrl?: string | null | undefined;
    launchCommands?: {
        id: string;
        label: string;
        executable: string;
        args: string[];
        cwd: string;
        scriptName: string;
    }[] | undefined;
    suggestedApplicationUrls?: {
        confidence: number;
        url: string;
        source: string;
    }[] | undefined;
}, {
    dirty: boolean;
    workspaceId: string;
    revision: string | null;
    branch: string | null;
    repositoryFingerprint: string;
    languages: string[];
    packageManager: string | null;
    frameworks: {
        framework: string;
        version: string | null;
        confidence: number;
        evidence: string[];
    }[];
    routes: string[];
    endpoints: string[];
    documentation: string[];
    manifestHashes: Record<string, string>;
    scannerVersion: string;
    redactionSummary: {
        excludedFiles: number;
        suspectedSecrets: number;
    };
    repositoryOriginHash?: string | null | undefined;
    repositoryCloneUrl?: string | null | undefined;
    launchCommands?: {
        id: string;
        label: string;
        executable: string;
        args: string[];
        cwd: string;
        scriptName: string;
    }[] | undefined;
    suggestedApplicationUrls?: {
        confidence: number;
        url: string;
        source: string;
    }[] | undefined;
}>;
export declare const RunCorrelationContextSchema: z.ZodObject<{
    runId: z.ZodString;
    sessionId: z.ZodString;
    traceId: z.ZodString;
    applicationId: z.ZodString;
    environmentId: z.ZodString;
    expectedGraphVersionId: z.ZodNullable<z.ZodString>;
    agentVersion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    runId: string;
    sessionId: string;
    traceId: string;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string | null;
    agentVersion: string;
}, {
    runId: string;
    sessionId: string;
    traceId: string;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string | null;
    agentVersion: string;
}>;
export declare const QARunArtifactSchema: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    type: z.ZodEnum<["SCREENSHOT", "PLAYWRIGHT_TRACE", "ACCESSIBILITY_SNAPSHOT", "CONSOLE_LOG", "NETWORK_LOG", "RUN_MANIFEST"]>;
    privacyClassification: z.ZodEnum<["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"]>;
    objectKey: z.ZodNullable<z.ZodString>;
    localPath: z.ZodNullable<z.ZodString>;
    bytes: z.ZodNumber;
    checksum: z.ZodString;
    capturedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "SCREENSHOT" | "PLAYWRIGHT_TRACE" | "ACCESSIBILITY_SNAPSHOT" | "CONSOLE_LOG" | "NETWORK_LOG" | "RUN_MANIFEST";
    runId: string;
    privacyClassification: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED";
    objectKey: string | null;
    localPath: string | null;
    bytes: number;
    checksum: string;
    capturedAt: string;
}, {
    id: string;
    type: "SCREENSHOT" | "PLAYWRIGHT_TRACE" | "ACCESSIBILITY_SNAPSHOT" | "CONSOLE_LOG" | "NETWORK_LOG" | "RUN_MANIFEST";
    runId: string;
    privacyClassification: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED";
    objectKey: string | null;
    localPath: string | null;
    bytes: number;
    checksum: string;
    capturedAt: string;
}>;
export declare const BrowserFindingSchema: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    category: z.ZodString;
    severity: z.ZodEnum<["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]>;
    confidence: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodString;
    url: z.ZodNullable<z.ZodString>;
    viewport: z.ZodNullable<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
    }, {
        width: number;
        height: number;
    }>>;
    evidenceArtifactIds: z.ZodArray<z.ZodString, "many">;
    reproductionSteps: z.ZodArray<z.ZodString, "many">;
    recommendation: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    confidence: number;
    url: string | null;
    runId: string;
    category: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    title: string;
    description: string;
    viewport: {
        width: number;
        height: number;
    } | null;
    evidenceArtifactIds: string[];
    reproductionSteps: string[];
    recommendation: string | null;
}, {
    id: string;
    confidence: number;
    url: string | null;
    runId: string;
    category: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    title: string;
    description: string;
    viewport: {
        width: number;
        height: number;
    } | null;
    evidenceArtifactIds: string[];
    reproductionSteps: string[];
    recommendation: string | null;
}>;
export declare const QARunSchema: z.ZodObject<{
    id: z.ZodString;
    applicationId: z.ZodString;
    environmentId: z.ZodString;
    workspaceId: z.ZodNullable<z.ZodString>;
    deviceSessionId: z.ZodNullable<z.ZodString>;
    expectedGraphVersionId: z.ZodNullable<z.ZodString>;
    flowId: z.ZodNullable<z.ZodString>;
    flowBindingId: z.ZodNullable<z.ZodString>;
    flowInitializationId: z.ZodNullable<z.ZodString>;
    flowScanId: z.ZodNullable<z.ZodString>;
    flowDriftId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    captureTracks: z.ZodArray<z.ZodEnum<["FRONTEND", "BACKEND"]>, "many">;
    initialStateKey: z.ZodNullable<z.ZodString>;
    terminalStateKeys: z.ZodArray<z.ZodString, "many">;
    lastObservedStateKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    boundaryStartedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    boundaryCompletedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completionReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodEnum<["GUIDED", "ASSISTED", "OBSERVATION_ONLY"]>;
    status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
    targetUrl: z.ZodString;
    startedAt: z.ZodNullable<z.ZodString>;
    endedAt: z.ZodNullable<z.ZodString>;
    failureReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
    workspaceId: string | null;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string | null;
    deviceSessionId: string | null;
    flowId: string | null;
    flowBindingId: string | null;
    flowInitializationId: string | null;
    flowScanId: string | null;
    captureTracks: ("FRONTEND" | "BACKEND")[];
    initialStateKey: string | null;
    terminalStateKeys: string[];
    mode: "GUIDED" | "ASSISTED" | "OBSERVATION_ONLY";
    targetUrl: string;
    startedAt: string | null;
    endedAt: string | null;
    failureReason: string | null;
    flowDriftId?: string | null | undefined;
    lastObservedStateKey?: string | null | undefined;
    boundaryStartedAt?: string | null | undefined;
    boundaryCompletedAt?: string | null | undefined;
    completionReason?: string | null | undefined;
}, {
    id: string;
    status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
    workspaceId: string | null;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string | null;
    deviceSessionId: string | null;
    flowId: string | null;
    flowBindingId: string | null;
    flowInitializationId: string | null;
    flowScanId: string | null;
    captureTracks: ("FRONTEND" | "BACKEND")[];
    initialStateKey: string | null;
    terminalStateKeys: string[];
    mode: "GUIDED" | "ASSISTED" | "OBSERVATION_ONLY";
    targetUrl: string;
    startedAt: string | null;
    endedAt: string | null;
    failureReason: string | null;
    flowDriftId?: string | null | undefined;
    lastObservedStateKey?: string | null | undefined;
    boundaryStartedAt?: string | null | undefined;
    boundaryCompletedAt?: string | null | undefined;
    completionReason?: string | null | undefined;
}>;
export declare const QARunSummarySchema: z.ZodObject<{
    id: z.ZodString;
    applicationId: z.ZodString;
    environmentId: z.ZodString;
    workspaceId: z.ZodNullable<z.ZodString>;
    deviceSessionId: z.ZodNullable<z.ZodString>;
    expectedGraphVersionId: z.ZodNullable<z.ZodString>;
    flowId: z.ZodNullable<z.ZodString>;
    flowBindingId: z.ZodNullable<z.ZodString>;
    flowInitializationId: z.ZodNullable<z.ZodString>;
    flowScanId: z.ZodNullable<z.ZodString>;
    flowDriftId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    captureTracks: z.ZodArray<z.ZodEnum<["FRONTEND", "BACKEND"]>, "many">;
    initialStateKey: z.ZodNullable<z.ZodString>;
    terminalStateKeys: z.ZodArray<z.ZodString, "many">;
    lastObservedStateKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    boundaryStartedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    boundaryCompletedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completionReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mode: z.ZodEnum<["GUIDED", "ASSISTED", "OBSERVATION_ONLY"]>;
    status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
    targetUrl: z.ZodString;
    startedAt: z.ZodNullable<z.ZodString>;
    endedAt: z.ZodNullable<z.ZodString>;
    failureReason: z.ZodNullable<z.ZodString>;
} & {
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    environment: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }>>;
    artifactCount: z.ZodDefault<z.ZodNumber>;
    findingCount: z.ZodDefault<z.ZodNumber>;
    reportId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
    workspaceId: string | null;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string | null;
    deviceSessionId: string | null;
    flowId: string | null;
    flowBindingId: string | null;
    flowInitializationId: string | null;
    flowScanId: string | null;
    captureTracks: ("FRONTEND" | "BACKEND")[];
    initialStateKey: string | null;
    terminalStateKeys: string[];
    mode: "GUIDED" | "ASSISTED" | "OBSERVATION_ONLY";
    targetUrl: string;
    startedAt: string | null;
    endedAt: string | null;
    failureReason: string | null;
    artifactCount: number;
    findingCount: number;
    flowDriftId?: string | null | undefined;
    lastObservedStateKey?: string | null | undefined;
    boundaryStartedAt?: string | null | undefined;
    boundaryCompletedAt?: string | null | undefined;
    completionReason?: string | null | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    environment?: {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    } | undefined;
    reportId?: string | null | undefined;
}, {
    id: string;
    status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
    workspaceId: string | null;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string | null;
    deviceSessionId: string | null;
    flowId: string | null;
    flowBindingId: string | null;
    flowInitializationId: string | null;
    flowScanId: string | null;
    captureTracks: ("FRONTEND" | "BACKEND")[];
    initialStateKey: string | null;
    terminalStateKeys: string[];
    mode: "GUIDED" | "ASSISTED" | "OBSERVATION_ONLY";
    targetUrl: string;
    startedAt: string | null;
    endedAt: string | null;
    failureReason: string | null;
    flowDriftId?: string | null | undefined;
    lastObservedStateKey?: string | null | undefined;
    boundaryStartedAt?: string | null | undefined;
    boundaryCompletedAt?: string | null | undefined;
    completionReason?: string | null | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    environment?: {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    } | undefined;
    artifactCount?: number | undefined;
    findingCount?: number | undefined;
    reportId?: string | null | undefined;
}>;
export declare const QualityReportSchema: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
    generatedAt: z.ZodString;
    application: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>;
    environment: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }>;
    flow: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        versionId: z.ZodString;
        version: z.ZodNumber;
        name: z.ZodString;
        purpose: z.ZodNullable<z.ZodString>;
        scopeStatement: z.ZodNullable<z.ZodString>;
        initialStateKey: z.ZodString;
        terminalStateKeys: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        purpose: string | null;
        version: number;
        initialStateKey: string;
        terminalStateKeys: string[];
        name: string;
        versionId: string;
        scopeStatement: string | null;
    }, {
        id: string;
        purpose: string | null;
        version: number;
        initialStateKey: string;
        terminalStateKeys: string[];
        name: string;
        versionId: string;
        scopeStatement: string | null;
    }>>;
    boundary: z.ZodObject<{
        status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
        startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        lastObservedStateKey: z.ZodNullable<z.ZodString>;
        completionReason: z.ZodNullable<z.ZodString>;
        timeoutAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        acceptedEvents: z.ZodArray<z.ZodUnknown, "many">;
        quarantinedEvents: z.ZodArray<z.ZodUnknown, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
        lastObservedStateKey: string | null;
        completionReason: string | null;
        startedAt: string | Date | null;
        completedAt: string | Date | null;
        timeoutAt: string | Date | null;
        acceptedEvents: unknown[];
        quarantinedEvents: unknown[];
    }, {
        status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
        lastObservedStateKey: string | null;
        completionReason: string | null;
        startedAt: string | Date | null;
        completedAt: string | Date | null;
        timeoutAt: string | Date | null;
        acceptedEvents: unknown[];
        quarantinedEvents: unknown[];
    }>;
    captureTracks: z.ZodArray<z.ZodEnum<["FRONTEND", "BACKEND"]>, "many">;
    correlation: z.ZodObject<{
        runId: z.ZodString;
        sessions: z.ZodArray<z.ZodObject<{
            sessionId: z.ZodString;
            traceId: z.ZodNullable<z.ZodString>;
            startedAt: z.ZodString;
            endedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }, {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        runId: string;
        sessions: {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }[];
    }, {
        runId: string;
        sessions: {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }[];
    }>;
    repository: z.ZodNullable<z.ZodObject<{
        revision: z.ZodNullable<z.ZodString>;
        dirty: z.ZodBoolean;
        scannerVersion: z.ZodString;
        redactionSummary: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        dirty: boolean;
        revision: string | null;
        scannerVersion: string;
        redactionSummary?: unknown;
    }, {
        dirty: boolean;
        revision: string | null;
        scannerVersion: string;
        redactionSummary?: unknown;
    }>>;
    instrumentation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        patchSetId: z.ZodString;
        planId: z.ZodString;
        adapterId: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
        adapterVersion: z.ZodString;
        manifestVersion: z.ZodString;
        status: z.ZodString;
        risk: z.ZodString;
        changedFileHashes: z.ZodUnknown;
        validation: z.ZodNullable<z.ZodUnknown>;
        appliedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        validatedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        patchSetId: string;
        planId: string;
        adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
        adapterVersion: string;
        manifestVersion: string;
        risk: string;
        appliedAt: string | Date | null;
        validatedAt: string | Date | null;
        validation?: unknown;
        changedFileHashes?: unknown;
    }, {
        status: string;
        patchSetId: string;
        planId: string;
        adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
        adapterVersion: string;
        manifestVersion: string;
        risk: string;
        appliedAt: string | Date | null;
        validatedAt: string | Date | null;
        validation?: unknown;
        changedFileHashes?: unknown;
    }>>>;
    expectedIntent: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        graphId: z.ZodString;
        graphVersionId: z.ZodString;
        graphName: z.ZodString;
        provenance: z.ZodString;
        evidenceManifest: z.ZodNullable<z.ZodUnknown>;
        expectedStateCount: z.ZodNullable<z.ZodNumber>;
        expectedTransitionCount: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        graphId: string;
        graphVersionId: string;
        graphName: string;
        provenance: string;
        expectedStateCount: number | null;
        expectedTransitionCount: number | null;
        evidenceManifest?: unknown;
    }, {
        graphId: string;
        graphVersionId: string;
        graphName: string;
        provenance: string;
        expectedStateCount: number | null;
        expectedTransitionCount: number | null;
        evidenceManifest?: unknown;
    }>>>;
    coverage: z.ZodObject<{
        expected: z.ZodNullable<z.ZodNumber>;
        reconciledFlows: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        expected: number | null;
        reconciledFlows: number;
    }, {
        expected: number | null;
        reconciledFlows: number;
    }>;
    findings: z.ZodArray<z.ZodUnknown, "many">;
    artifacts: z.ZodArray<z.ZodUnknown, "many">;
    summary: z.ZodObject<{
        sessionCount: z.ZodNumber;
        observedStateCount: z.ZodNumber;
        observedTransitionCount: z.ZodNumber;
        artifactCount: z.ZodNumber;
        findingCount: z.ZodNumber;
        criticalOrHighFindings: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        artifactCount: number;
        findingCount: number;
        sessionCount: number;
        observedStateCount: number;
        observedTransitionCount: number;
        criticalOrHighFindings: number;
    }, {
        artifactCount: number;
        findingCount: number;
        sessionCount: number;
        observedStateCount: number;
        observedTransitionCount: number;
        criticalOrHighFindings: number;
    }>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    runId: z.ZodString;
    status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
    generatedAt: z.ZodString;
    application: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>;
    environment: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }>;
    flow: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        versionId: z.ZodString;
        version: z.ZodNumber;
        name: z.ZodString;
        purpose: z.ZodNullable<z.ZodString>;
        scopeStatement: z.ZodNullable<z.ZodString>;
        initialStateKey: z.ZodString;
        terminalStateKeys: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        purpose: string | null;
        version: number;
        initialStateKey: string;
        terminalStateKeys: string[];
        name: string;
        versionId: string;
        scopeStatement: string | null;
    }, {
        id: string;
        purpose: string | null;
        version: number;
        initialStateKey: string;
        terminalStateKeys: string[];
        name: string;
        versionId: string;
        scopeStatement: string | null;
    }>>;
    boundary: z.ZodObject<{
        status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
        startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        lastObservedStateKey: z.ZodNullable<z.ZodString>;
        completionReason: z.ZodNullable<z.ZodString>;
        timeoutAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        acceptedEvents: z.ZodArray<z.ZodUnknown, "many">;
        quarantinedEvents: z.ZodArray<z.ZodUnknown, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
        lastObservedStateKey: string | null;
        completionReason: string | null;
        startedAt: string | Date | null;
        completedAt: string | Date | null;
        timeoutAt: string | Date | null;
        acceptedEvents: unknown[];
        quarantinedEvents: unknown[];
    }, {
        status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
        lastObservedStateKey: string | null;
        completionReason: string | null;
        startedAt: string | Date | null;
        completedAt: string | Date | null;
        timeoutAt: string | Date | null;
        acceptedEvents: unknown[];
        quarantinedEvents: unknown[];
    }>;
    captureTracks: z.ZodArray<z.ZodEnum<["FRONTEND", "BACKEND"]>, "many">;
    correlation: z.ZodObject<{
        runId: z.ZodString;
        sessions: z.ZodArray<z.ZodObject<{
            sessionId: z.ZodString;
            traceId: z.ZodNullable<z.ZodString>;
            startedAt: z.ZodString;
            endedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }, {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        runId: string;
        sessions: {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }[];
    }, {
        runId: string;
        sessions: {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }[];
    }>;
    repository: z.ZodNullable<z.ZodObject<{
        revision: z.ZodNullable<z.ZodString>;
        dirty: z.ZodBoolean;
        scannerVersion: z.ZodString;
        redactionSummary: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        dirty: boolean;
        revision: string | null;
        scannerVersion: string;
        redactionSummary?: unknown;
    }, {
        dirty: boolean;
        revision: string | null;
        scannerVersion: string;
        redactionSummary?: unknown;
    }>>;
    instrumentation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        patchSetId: z.ZodString;
        planId: z.ZodString;
        adapterId: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
        adapterVersion: z.ZodString;
        manifestVersion: z.ZodString;
        status: z.ZodString;
        risk: z.ZodString;
        changedFileHashes: z.ZodUnknown;
        validation: z.ZodNullable<z.ZodUnknown>;
        appliedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        validatedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        patchSetId: string;
        planId: string;
        adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
        adapterVersion: string;
        manifestVersion: string;
        risk: string;
        appliedAt: string | Date | null;
        validatedAt: string | Date | null;
        validation?: unknown;
        changedFileHashes?: unknown;
    }, {
        status: string;
        patchSetId: string;
        planId: string;
        adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
        adapterVersion: string;
        manifestVersion: string;
        risk: string;
        appliedAt: string | Date | null;
        validatedAt: string | Date | null;
        validation?: unknown;
        changedFileHashes?: unknown;
    }>>>;
    expectedIntent: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        graphId: z.ZodString;
        graphVersionId: z.ZodString;
        graphName: z.ZodString;
        provenance: z.ZodString;
        evidenceManifest: z.ZodNullable<z.ZodUnknown>;
        expectedStateCount: z.ZodNullable<z.ZodNumber>;
        expectedTransitionCount: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        graphId: string;
        graphVersionId: string;
        graphName: string;
        provenance: string;
        expectedStateCount: number | null;
        expectedTransitionCount: number | null;
        evidenceManifest?: unknown;
    }, {
        graphId: string;
        graphVersionId: string;
        graphName: string;
        provenance: string;
        expectedStateCount: number | null;
        expectedTransitionCount: number | null;
        evidenceManifest?: unknown;
    }>>>;
    coverage: z.ZodObject<{
        expected: z.ZodNullable<z.ZodNumber>;
        reconciledFlows: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        expected: number | null;
        reconciledFlows: number;
    }, {
        expected: number | null;
        reconciledFlows: number;
    }>;
    findings: z.ZodArray<z.ZodUnknown, "many">;
    artifacts: z.ZodArray<z.ZodUnknown, "many">;
    summary: z.ZodObject<{
        sessionCount: z.ZodNumber;
        observedStateCount: z.ZodNumber;
        observedTransitionCount: z.ZodNumber;
        artifactCount: z.ZodNumber;
        findingCount: z.ZodNumber;
        criticalOrHighFindings: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        artifactCount: number;
        findingCount: number;
        sessionCount: number;
        observedStateCount: number;
        observedTransitionCount: number;
        criticalOrHighFindings: number;
    }, {
        artifactCount: number;
        findingCount: number;
        sessionCount: number;
        observedStateCount: number;
        observedTransitionCount: number;
        criticalOrHighFindings: number;
    }>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    runId: z.ZodString;
    status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
    generatedAt: z.ZodString;
    application: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>;
    environment: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
    }>;
    flow: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        versionId: z.ZodString;
        version: z.ZodNumber;
        name: z.ZodString;
        purpose: z.ZodNullable<z.ZodString>;
        scopeStatement: z.ZodNullable<z.ZodString>;
        initialStateKey: z.ZodString;
        terminalStateKeys: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        purpose: string | null;
        version: number;
        initialStateKey: string;
        terminalStateKeys: string[];
        name: string;
        versionId: string;
        scopeStatement: string | null;
    }, {
        id: string;
        purpose: string | null;
        version: number;
        initialStateKey: string;
        terminalStateKeys: string[];
        name: string;
        versionId: string;
        scopeStatement: string | null;
    }>>;
    boundary: z.ZodObject<{
        status: z.ZodEnum<["CREATED", "DRAFT", "PREPARING", "WAITING_FOR_PERMISSION", "READY", "ARMED", "WAITING_FOR_INITIAL", "RECORDING", "RUNNING", "PAUSED", "ENDING", "UPLOADING", "PROCESSING", "RECONCILING", "REPORTING", "COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "PARTIAL"]>;
        startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        lastObservedStateKey: z.ZodNullable<z.ZodString>;
        completionReason: z.ZodNullable<z.ZodString>;
        timeoutAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        acceptedEvents: z.ZodArray<z.ZodUnknown, "many">;
        quarantinedEvents: z.ZodArray<z.ZodUnknown, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
        lastObservedStateKey: string | null;
        completionReason: string | null;
        startedAt: string | Date | null;
        completedAt: string | Date | null;
        timeoutAt: string | Date | null;
        acceptedEvents: unknown[];
        quarantinedEvents: unknown[];
    }, {
        status: "CREATED" | "DRAFT" | "PREPARING" | "WAITING_FOR_PERMISSION" | "READY" | "ARMED" | "WAITING_FOR_INITIAL" | "RECORDING" | "RUNNING" | "PAUSED" | "ENDING" | "UPLOADING" | "PROCESSING" | "RECONCILING" | "REPORTING" | "COMPLETED" | "COMPLETED_INCOMPLETE" | "FAILED" | "CANCELLED" | "PARTIAL";
        lastObservedStateKey: string | null;
        completionReason: string | null;
        startedAt: string | Date | null;
        completedAt: string | Date | null;
        timeoutAt: string | Date | null;
        acceptedEvents: unknown[];
        quarantinedEvents: unknown[];
    }>;
    captureTracks: z.ZodArray<z.ZodEnum<["FRONTEND", "BACKEND"]>, "many">;
    correlation: z.ZodObject<{
        runId: z.ZodString;
        sessions: z.ZodArray<z.ZodObject<{
            sessionId: z.ZodString;
            traceId: z.ZodNullable<z.ZodString>;
            startedAt: z.ZodString;
            endedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }, {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        runId: string;
        sessions: {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }[];
    }, {
        runId: string;
        sessions: {
            sessionId: string;
            traceId: string | null;
            startedAt: string;
            endedAt: string | null;
        }[];
    }>;
    repository: z.ZodNullable<z.ZodObject<{
        revision: z.ZodNullable<z.ZodString>;
        dirty: z.ZodBoolean;
        scannerVersion: z.ZodString;
        redactionSummary: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        dirty: boolean;
        revision: string | null;
        scannerVersion: string;
        redactionSummary?: unknown;
    }, {
        dirty: boolean;
        revision: string | null;
        scannerVersion: string;
        redactionSummary?: unknown;
    }>>;
    instrumentation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        patchSetId: z.ZodString;
        planId: z.ZodString;
        adapterId: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
        adapterVersion: z.ZodString;
        manifestVersion: z.ZodString;
        status: z.ZodString;
        risk: z.ZodString;
        changedFileHashes: z.ZodUnknown;
        validation: z.ZodNullable<z.ZodUnknown>;
        appliedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        validatedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        patchSetId: string;
        planId: string;
        adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
        adapterVersion: string;
        manifestVersion: string;
        risk: string;
        appliedAt: string | Date | null;
        validatedAt: string | Date | null;
        validation?: unknown;
        changedFileHashes?: unknown;
    }, {
        status: string;
        patchSetId: string;
        planId: string;
        adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
        adapterVersion: string;
        manifestVersion: string;
        risk: string;
        appliedAt: string | Date | null;
        validatedAt: string | Date | null;
        validation?: unknown;
        changedFileHashes?: unknown;
    }>>>;
    expectedIntent: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        graphId: z.ZodString;
        graphVersionId: z.ZodString;
        graphName: z.ZodString;
        provenance: z.ZodString;
        evidenceManifest: z.ZodNullable<z.ZodUnknown>;
        expectedStateCount: z.ZodNullable<z.ZodNumber>;
        expectedTransitionCount: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        graphId: string;
        graphVersionId: string;
        graphName: string;
        provenance: string;
        expectedStateCount: number | null;
        expectedTransitionCount: number | null;
        evidenceManifest?: unknown;
    }, {
        graphId: string;
        graphVersionId: string;
        graphName: string;
        provenance: string;
        expectedStateCount: number | null;
        expectedTransitionCount: number | null;
        evidenceManifest?: unknown;
    }>>>;
    coverage: z.ZodObject<{
        expected: z.ZodNullable<z.ZodNumber>;
        reconciledFlows: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        expected: number | null;
        reconciledFlows: number;
    }, {
        expected: number | null;
        reconciledFlows: number;
    }>;
    findings: z.ZodArray<z.ZodUnknown, "many">;
    artifacts: z.ZodArray<z.ZodUnknown, "many">;
    summary: z.ZodObject<{
        sessionCount: z.ZodNumber;
        observedStateCount: z.ZodNumber;
        observedTransitionCount: z.ZodNumber;
        artifactCount: z.ZodNumber;
        findingCount: z.ZodNumber;
        criticalOrHighFindings: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        artifactCount: number;
        findingCount: number;
        sessionCount: number;
        observedStateCount: number;
        observedTransitionCount: number;
        criticalOrHighFindings: number;
    }, {
        artifactCount: number;
        findingCount: number;
        sessionCount: number;
        observedStateCount: number;
        observedTransitionCount: number;
        criticalOrHighFindings: number;
    }>;
}, z.ZodTypeAny, "passthrough">>;
export declare const DeclaredFlowSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodString;
    lifecycleStatus: z.ZodOptional<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED", "SUPERSEDED"]>>;
    purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scopeStatement: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    exclusions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publishedVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodString>;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        isBaseline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }>, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodString;
    lifecycleStatus: z.ZodOptional<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED", "SUPERSEDED"]>>;
    purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scopeStatement: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    exclusions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publishedVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodString>;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        isBaseline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }>, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodString;
    lifecycleStatus: z.ZodOptional<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED", "SUPERSEDED"]>>;
    purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scopeStatement: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    exclusions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publishedVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodString>;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        isBaseline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }>, "many">>;
}, z.ZodTypeAny, "passthrough">>;
export declare const DeclaredStateSchema: z.ZodObject<{
    id: z.ZodString;
    stateName: z.ZodString;
    category: z.ZodString;
    provenance: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
    terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
    canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    stateName: z.ZodString;
    category: z.ZodString;
    provenance: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
    terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
    canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    stateName: z.ZodString;
    category: z.ZodString;
    provenance: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
    terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
    canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const DeclaredTransitionSchema: z.ZodObject<{
    id: z.ZodString;
    fromStateId: z.ZodString;
    toStateId: z.ZodString;
    action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provenance: z.ZodString;
    fromState: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>>;
    toState: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    fromStateId: z.ZodString;
    toStateId: z.ZodString;
    action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provenance: z.ZodString;
    fromState: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>>;
    toState: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    fromStateId: z.ZodString;
    toStateId: z.ZodString;
    action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provenance: z.ZodString;
    fromState: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>>;
    toState: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const DeclaredFlowDetailSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodString;
    lifecycleStatus: z.ZodOptional<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED", "SUPERSEDED"]>>;
    purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scopeStatement: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    exclusions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publishedVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodString>;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        isBaseline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }>, "many">>;
} & {
    workflowType: z.ZodString;
    states: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
    transitions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodString;
    lifecycleStatus: z.ZodOptional<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED", "SUPERSEDED"]>>;
    purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scopeStatement: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    exclusions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publishedVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodString>;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        isBaseline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }>, "many">>;
} & {
    workflowType: z.ZodString;
    states: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
    transitions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    name: z.ZodString;
    status: z.ZodString;
    lifecycleStatus: z.ZodOptional<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED", "SUPERSEDED"]>>;
    purpose: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scopeStatement: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    exclusions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publishedVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodOptional<z.ZodNumber>;
    updatedAt: z.ZodOptional<z.ZodString>;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        isBaseline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }, {
        id: string;
        version: number;
        isBaseline?: boolean | undefined;
    }>, "many">>;
} & {
    workflowType: z.ZodString;
    states: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        stateName: z.ZodString;
        category: z.ZodString;
        provenance: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
    transitions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        fromStateId: z.ZodString;
        toStateId: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        provenance: z.ZodString;
        fromState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
        toState: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            stateName: z.ZodString;
            category: z.ZodString;
            provenance: z.ZodString;
            role: z.ZodDefault<z.ZodEnum<["NORMAL", "INITIAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
            canonicalBehavior: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, z.ZodTypeAny, "passthrough">>;
export declare const DeclaredSuggestionStateSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
    terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
}, "strip", z.ZodTypeAny, {
    category: string;
    name: string;
    role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
    terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
}, {
    category: string;
    name: string;
    role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
    terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
}>;
export declare const DeclaredSuggestionTransitionSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    action?: string | null | undefined;
}, {
    from: string;
    to: string;
    action?: string | null | undefined;
}>;
export declare const DeclaredStateSuggestionSchema: z.ZodObject<{
    id: z.ZodString;
    suggestedStateName: z.ZodString;
    category: z.ZodString;
    rationale: z.ZodString;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
    sourceTier: z.ZodString;
    confidence: z.ZodNumber;
    severity: z.ZodString;
    status: z.ZodString;
    graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        category: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        name: string;
        role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
        terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
    }, {
        category: string;
        name: string;
        role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
        terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
    }>, "many">>>;
    suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        action?: string | null | undefined;
    }, {
        from: string;
        to: string;
        action?: string | null | undefined;
    }>, "many">>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    suggestedStateName: z.ZodString;
    category: z.ZodString;
    rationale: z.ZodString;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
    sourceTier: z.ZodString;
    confidence: z.ZodNumber;
    severity: z.ZodString;
    status: z.ZodString;
    graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        category: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        name: string;
        role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
        terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
    }, {
        category: string;
        name: string;
        role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
        terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
    }>, "many">>>;
    suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        action?: string | null | undefined;
    }, {
        from: string;
        to: string;
        action?: string | null | undefined;
    }>, "many">>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    suggestedStateName: z.ZodString;
    category: z.ZodString;
    rationale: z.ZodString;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
    sourceTier: z.ZodString;
    confidence: z.ZodNumber;
    severity: z.ZodString;
    status: z.ZodString;
    graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        category: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        name: string;
        role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
        terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
    }, {
        category: string;
        name: string;
        role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
        terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
    }>, "many">>>;
    suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        action?: string | null | undefined;
    }, {
        from: string;
        to: string;
        action?: string | null | undefined;
    }>, "many">>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const FlowSuggestionMetaSchema: z.ZodObject<{
    ruleCount: z.ZodDefault<z.ZodNumber>;
    aiCount: z.ZodDefault<z.ZodNumber>;
    aiAllowed: z.ZodDefault<z.ZodBoolean>;
    aiAttempted: z.ZodDefault<z.ZodBoolean>;
    fallbackUsed: z.ZodDefault<z.ZodBoolean>;
    mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
    latencyMs: z.ZodOptional<z.ZodNumber>;
    stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    ruleCount: z.ZodDefault<z.ZodNumber>;
    aiCount: z.ZodDefault<z.ZodNumber>;
    aiAllowed: z.ZodDefault<z.ZodBoolean>;
    aiAttempted: z.ZodDefault<z.ZodBoolean>;
    fallbackUsed: z.ZodDefault<z.ZodBoolean>;
    mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
    latencyMs: z.ZodOptional<z.ZodNumber>;
    stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    ruleCount: z.ZodDefault<z.ZodNumber>;
    aiCount: z.ZodDefault<z.ZodNumber>;
    aiAllowed: z.ZodDefault<z.ZodBoolean>;
    aiAttempted: z.ZodDefault<z.ZodBoolean>;
    fallbackUsed: z.ZodDefault<z.ZodBoolean>;
    mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
    latencyMs: z.ZodOptional<z.ZodNumber>;
    stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const FlowSuggestionsResponseSchema: z.ZodObject<{
    graphVersion: z.ZodNumber;
    graphHash: z.ZodString;
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    suggestions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    graphVersion: z.ZodNumber;
    graphHash: z.ZodString;
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    suggestions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    graphVersion: z.ZodNumber;
    graphHash: z.ZodString;
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    suggestions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        suggestedStateName: z.ZodString;
        category: z.ZodString;
        rationale: z.ZodString;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodDefault<z.ZodEnum<["RULE_ENGINE", "AI", "HYBRID"]>>;
        sourceTier: z.ZodString;
        confidence: z.ZodNumber;
        severity: z.ZodString;
        status: z.ZodString;
        graphVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        graphHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedStatesJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["SUCCESS", "FAILURE", "CANCELLATION", "ALTERNATE"]>>>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }, {
            category: string;
            name: string;
            role?: "NORMAL" | "INITIAL" | "TERMINAL" | undefined;
            terminalKind?: "SUCCESS" | "FAILURE" | "CANCELLATION" | "ALTERNATE" | null | undefined;
        }>, "many">>>;
        suggestedTransitionsJson: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            action: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }, {
            from: string;
            to: string;
            action?: string | null | undefined;
        }>, "many">>>;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        ruleCount: z.ZodDefault<z.ZodNumber>;
        aiCount: z.ZodDefault<z.ZodNumber>;
        aiAllowed: z.ZodDefault<z.ZodBoolean>;
        aiAttempted: z.ZodDefault<z.ZodBoolean>;
        fallbackUsed: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodDefault<z.ZodEnum<["RULE_ONLY", "AI_ASSISTED", "RULE_FALLBACK"]>>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
        stage: z.ZodOptional<z.ZodEnum<["GAP_REVIEW", "CONNECTION_REPAIR", "ENRICHMENT"]>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const FlowDiagramSchema: z.ZodObject<{
    kind: z.ZodEnum<["FLOW", "SEQUENCE", "ACTIVITY", "STATE_MACHINE"]>;
    renderer: z.ZodLiteral<"MERMAID">;
    rendererVersion: z.ZodString;
    source: z.ZodString;
    semanticNodeIds: z.ZodArray<z.ZodString, "many">;
    semanticEdgeIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    source: string;
    kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
    renderer: "MERMAID";
    rendererVersion: string;
    semanticNodeIds: string[];
    semanticEdgeIds: string[];
}, {
    source: string;
    kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
    renderer: "MERMAID";
    rendererVersion: string;
    semanticNodeIds: string[];
    semanticEdgeIds: string[];
}>;
export declare const FlowReviewPreviewSchema: z.ZodObject<{
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    graphVersion: z.ZodNumber;
    graphHash: z.ZodString;
    validation: z.ZodObject<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, z.ZodTypeAny, "passthrough">>;
    diagrams: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["FLOW", "SEQUENCE", "ACTIVITY", "STATE_MACHINE"]>;
        renderer: z.ZodLiteral<"MERMAID">;
        rendererVersion: z.ZodString;
        source: z.ZodString;
        semanticNodeIds: z.ZodArray<z.ZodString, "many">;
        semanticEdgeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        source: string;
        kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
        renderer: "MERMAID";
        rendererVersion: string;
        semanticNodeIds: string[];
        semanticEdgeIds: string[];
    }, {
        source: string;
        kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
        renderer: "MERMAID";
        rendererVersion: string;
        semanticNodeIds: string[];
        semanticEdgeIds: string[];
    }>, "many">;
    proposedStates: z.ZodArray<z.ZodAny, "many">;
    proposedTransitions: z.ZodArray<z.ZodAny, "many">;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    graphVersion: z.ZodNumber;
    graphHash: z.ZodString;
    validation: z.ZodObject<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, z.ZodTypeAny, "passthrough">>;
    diagrams: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["FLOW", "SEQUENCE", "ACTIVITY", "STATE_MACHINE"]>;
        renderer: z.ZodLiteral<"MERMAID">;
        rendererVersion: z.ZodString;
        source: z.ZodString;
        semanticNodeIds: z.ZodArray<z.ZodString, "many">;
        semanticEdgeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        source: string;
        kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
        renderer: "MERMAID";
        rendererVersion: string;
        semanticNodeIds: string[];
        semanticEdgeIds: string[];
    }, {
        source: string;
        kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
        renderer: "MERMAID";
        rendererVersion: string;
        semanticNodeIds: string[];
        semanticEdgeIds: string[];
    }>, "many">;
    proposedStates: z.ZodArray<z.ZodAny, "many">;
    proposedTransitions: z.ZodArray<z.ZodAny, "many">;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    reviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    graphVersion: z.ZodNumber;
    graphHash: z.ZodString;
    validation: z.ZodObject<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        valid: z.ZodBoolean;
        issues: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            code: z.ZodString;
            message: z.ZodString;
        }, z.ZodTypeAny, "passthrough">>, "many">;
    }, z.ZodTypeAny, "passthrough">>;
    diagrams: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["FLOW", "SEQUENCE", "ACTIVITY", "STATE_MACHINE"]>;
        renderer: z.ZodLiteral<"MERMAID">;
        rendererVersion: z.ZodString;
        source: z.ZodString;
        semanticNodeIds: z.ZodArray<z.ZodString, "many">;
        semanticEdgeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        source: string;
        kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
        renderer: "MERMAID";
        rendererVersion: string;
        semanticNodeIds: string[];
        semanticEdgeIds: string[];
    }, {
        source: string;
        kind: "FLOW" | "SEQUENCE" | "ACTIVITY" | "STATE_MACHINE";
        renderer: "MERMAID";
        rendererVersion: string;
        semanticNodeIds: string[];
        semanticEdgeIds: string[];
    }>, "many">;
    proposedStates: z.ZodArray<z.ZodAny, "many">;
    proposedTransitions: z.ZodArray<z.ZodAny, "many">;
}, z.ZodTypeAny, "passthrough">>;
export declare const FlowProjectBindingSchema: z.ZodObject<{
    id: z.ZodString;
    flowId: z.ZodString;
    flowVersionId: z.ZodString;
    workspaceId: z.ZodString;
    environmentId: z.ZodString;
    status: z.ZodEnum<["PENDING_INITIALIZATION", "INITIALIZING", "ACTIVE", "STALE", "FAILED", "REQUIRES_REBASE"]>;
    currentScanId: z.ZodNullable<z.ZodString>;
    initializedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    lastRescannedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    flowId: z.ZodString;
    flowVersionId: z.ZodString;
    workspaceId: z.ZodString;
    environmentId: z.ZodString;
    status: z.ZodEnum<["PENDING_INITIALIZATION", "INITIALIZING", "ACTIVE", "STALE", "FAILED", "REQUIRES_REBASE"]>;
    currentScanId: z.ZodNullable<z.ZodString>;
    initializedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    lastRescannedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    flowId: z.ZodString;
    flowVersionId: z.ZodString;
    workspaceId: z.ZodString;
    environmentId: z.ZodString;
    status: z.ZodEnum<["PENDING_INITIALIZATION", "INITIALIZING", "ACTIVE", "STALE", "FAILED", "REQUIRES_REBASE"]>;
    currentScanId: z.ZodNullable<z.ZodString>;
    initializedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    lastRescannedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const FlowCheckpointSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["STATE", "TRANSITION"]>;
    stateId: z.ZodNullable<z.ZodString>;
    transitionId: z.ZodNullable<z.ZodString>;
    stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
    terminalKind: z.ZodNullable<z.ZodString>;
    eventType: z.ZodString;
    expectedState: z.ZodNullable<z.ZodString>;
    fromCheckpointId: z.ZodNullable<z.ZodString>;
    toCheckpointId: z.ZodNullable<z.ZodString>;
    required: z.ZodBoolean;
    mapping: z.ZodObject<{
        file: z.ZodNullable<z.ZodString>;
        symbol: z.ZodNullable<z.ZodString>;
        confidence: z.ZodNumber;
        rationale: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        symbol: string | null;
        confidence: number;
        rationale: string;
        file: string | null;
    }, {
        symbol: string | null;
        confidence: number;
        rationale: string;
        file: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    terminalKind: string | null;
    kind: "STATE" | "TRANSITION";
    stateId: string | null;
    transitionId: string | null;
    stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
    eventType: string;
    expectedState: string | null;
    fromCheckpointId: string | null;
    toCheckpointId: string | null;
    required: boolean;
    mapping: {
        symbol: string | null;
        confidence: number;
        rationale: string;
        file: string | null;
    };
}, {
    id: string;
    terminalKind: string | null;
    kind: "STATE" | "TRANSITION";
    stateId: string | null;
    transitionId: string | null;
    stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
    eventType: string;
    expectedState: string | null;
    fromCheckpointId: string | null;
    toCheckpointId: string | null;
    required: boolean;
    mapping: {
        symbol: string | null;
        confidence: number;
        rationale: string;
        file: string | null;
    };
}>;
export declare const FlowInitializationManifestSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0">;
    graphVersionId: z.ZodString;
    graphHash: z.ZodString;
    repositorySnapshotId: z.ZodString;
    initialStateId: z.ZodString;
    terminalStateIds: z.ZodArray<z.ZodString, "many">;
    paths: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    unreachableStateIds: z.ZodArray<z.ZodString, "many">;
    checkpoints: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["STATE", "TRANSITION"]>;
        stateId: z.ZodNullable<z.ZodString>;
        transitionId: z.ZodNullable<z.ZodString>;
        stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
        terminalKind: z.ZodNullable<z.ZodString>;
        eventType: z.ZodString;
        expectedState: z.ZodNullable<z.ZodString>;
        fromCheckpointId: z.ZodNullable<z.ZodString>;
        toCheckpointId: z.ZodNullable<z.ZodString>;
        required: z.ZodBoolean;
        mapping: z.ZodObject<{
            file: z.ZodNullable<z.ZodString>;
            symbol: z.ZodNullable<z.ZodString>;
            confidence: z.ZodNumber;
            rationale: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            symbol: string | null;
            confidence: number;
            rationale: string;
            file: string | null;
        }, {
            symbol: string | null;
            confidence: number;
            rationale: string;
            file: string | null;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        terminalKind: string | null;
        kind: "STATE" | "TRANSITION";
        stateId: string | null;
        transitionId: string | null;
        stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
        eventType: string;
        expectedState: string | null;
        fromCheckpointId: string | null;
        toCheckpointId: string | null;
        required: boolean;
        mapping: {
            symbol: string | null;
            confidence: number;
            rationale: string;
            file: string | null;
        };
    }, {
        id: string;
        terminalKind: string | null;
        kind: "STATE" | "TRANSITION";
        stateId: string | null;
        transitionId: string | null;
        stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
        eventType: string;
        expectedState: string | null;
        fromCheckpointId: string | null;
        toCheckpointId: string | null;
        required: boolean;
        mapping: {
            symbol: string | null;
            confidence: number;
            rationale: string;
            file: string | null;
        };
    }>, "many">;
    generatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: "1.0";
    generatedAt: string;
    graphVersionId: string;
    graphHash: string;
    repositorySnapshotId: string;
    initialStateId: string;
    terminalStateIds: string[];
    paths: string[][];
    unreachableStateIds: string[];
    checkpoints: {
        id: string;
        terminalKind: string | null;
        kind: "STATE" | "TRANSITION";
        stateId: string | null;
        transitionId: string | null;
        stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
        eventType: string;
        expectedState: string | null;
        fromCheckpointId: string | null;
        toCheckpointId: string | null;
        required: boolean;
        mapping: {
            symbol: string | null;
            confidence: number;
            rationale: string;
            file: string | null;
        };
    }[];
}, {
    version: "1.0";
    generatedAt: string;
    graphVersionId: string;
    graphHash: string;
    repositorySnapshotId: string;
    initialStateId: string;
    terminalStateIds: string[];
    paths: string[][];
    unreachableStateIds: string[];
    checkpoints: {
        id: string;
        terminalKind: string | null;
        kind: "STATE" | "TRANSITION";
        stateId: string | null;
        transitionId: string | null;
        stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
        eventType: string;
        expectedState: string | null;
        fromCheckpointId: string | null;
        toCheckpointId: string | null;
        required: boolean;
        mapping: {
            symbol: string | null;
            confidence: number;
            rationale: string;
            file: string | null;
        };
    }[];
}>;
export declare const FlowCodeReviewReportSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0">;
    kind: z.ZodLiteral<"FLOW_CODE_REVIEW">;
    generatedAt: z.ZodString;
    engine: z.ZodEnum<["HYBRID", "RULES_FALLBACK"]>;
    summary: z.ZodObject<{
        mappedStates: z.ZodNumber;
        totalStates: z.ZodNumber;
        mappedTransitions: z.ZodNumber;
        totalTransitions: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        mappedStates: number;
        totalStates: number;
        mappedTransitions: number;
        totalTransitions: number;
    }, {
        mappedStates: number;
        totalStates: number;
        mappedTransitions: number;
        totalTransitions: number;
    }>;
    stateFindings: z.ZodArray<z.ZodAny, "many">;
    transitionFindings: z.ZodArray<z.ZodAny, "many">;
    missingStates: z.ZodArray<z.ZodAny, "many">;
    incompleteTransitions: z.ZodArray<z.ZodAny, "many">;
    edgeCases: z.ZodArray<z.ZodAny, "many">;
    uncoveredTerminalOutcomes: z.ZodArray<z.ZodAny, "many">;
    evidence: z.ZodArray<z.ZodAny, "many">;
    recommendations: z.ZodArray<z.ZodAny, "many">;
    limitations: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    version: "1.0";
    evidence: any[];
    generatedAt: string;
    summary: {
        mappedStates: number;
        totalStates: number;
        mappedTransitions: number;
        totalTransitions: number;
    };
    kind: "FLOW_CODE_REVIEW";
    engine: "HYBRID" | "RULES_FALLBACK";
    stateFindings: any[];
    transitionFindings: any[];
    missingStates: any[];
    incompleteTransitions: any[];
    edgeCases: any[];
    uncoveredTerminalOutcomes: any[];
    recommendations: any[];
    limitations: string[];
}, {
    version: "1.0";
    evidence: any[];
    generatedAt: string;
    summary: {
        mappedStates: number;
        totalStates: number;
        mappedTransitions: number;
        totalTransitions: number;
    };
    kind: "FLOW_CODE_REVIEW";
    engine: "HYBRID" | "RULES_FALLBACK";
    stateFindings: any[];
    transitionFindings: any[];
    missingStates: any[];
    incompleteTransitions: any[];
    edgeCases: any[];
    uncoveredTerminalOutcomes: any[];
    recommendations: any[];
    limitations: string[];
}>;
export declare const FlowReviewEnrichmentSchema: z.ZodObject<{
    recommendations: z.ZodArray<z.ZodObject<{
        checkpointId: z.ZodString;
        explanation: z.ZodString;
        priority: z.ZodEnum<["BLOCKING", "HIGH", "MEDIUM", "LOW"]>;
    }, "strip", z.ZodTypeAny, {
        checkpointId: string;
        explanation: string;
        priority: "HIGH" | "MEDIUM" | "LOW" | "BLOCKING";
    }, {
        checkpointId: string;
        explanation: string;
        priority: "HIGH" | "MEDIUM" | "LOW" | "BLOCKING";
    }>, "many">;
    edgeCaseExplanations: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        explanation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        explanation: string;
    }, {
        code: string;
        explanation: string;
    }>, "many">;
    summary: z.ZodString;
}, "strip", z.ZodTypeAny, {
    summary: string;
    recommendations: {
        checkpointId: string;
        explanation: string;
        priority: "HIGH" | "MEDIUM" | "LOW" | "BLOCKING";
    }[];
    edgeCaseExplanations: {
        code: string;
        explanation: string;
    }[];
}, {
    summary: string;
    recommendations: {
        checkpointId: string;
        explanation: string;
        priority: "HIGH" | "MEDIUM" | "LOW" | "BLOCKING";
    }[];
    edgeCaseExplanations: {
        code: string;
        explanation: string;
    }[];
}>;
export declare const ManualRoadmapStepSchema: z.ZodObject<{
    id: z.ZodString;
    groupId: z.ZodString;
    kind: z.ZodEnum<["PREREQUISITE", "STATE", "TRANSITION", "TERMINAL", "VERIFY"]>;
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodEnum<["PENDING", "CURRENT", "DONE", "VERIFIED", "BLOCKED"]>;
    dependencies: z.ZodArray<z.ZodString, "many">;
    file: z.ZodNullable<z.ZodString>;
    symbol: z.ZodNullable<z.ZodString>;
    snippet: z.ZodString;
    eventType: z.ZodNullable<z.ZodString>;
    checkpointId: z.ZodNullable<z.ZodString>;
    userCompletedAt: z.ZodNullable<z.ZodString>;
    verificationEvidence: z.ZodArray<z.ZodAny, "many">;
}, "strip", z.ZodTypeAny, {
    symbol: string | null;
    id: string;
    status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
    title: string;
    description: string;
    kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
    eventType: string | null;
    file: string | null;
    checkpointId: string | null;
    groupId: string;
    dependencies: string[];
    snippet: string;
    userCompletedAt: string | null;
    verificationEvidence: any[];
}, {
    symbol: string | null;
    id: string;
    status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
    title: string;
    description: string;
    kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
    eventType: string | null;
    file: string | null;
    checkpointId: string | null;
    groupId: string;
    dependencies: string[];
    snippet: string;
    userCompletedAt: string | null;
    verificationEvidence: any[];
}>;
export declare const ManualRoadmapSchema: z.ZodObject<{
    version: z.ZodLiteral<"1.0">;
    revision: z.ZodNumber;
    groups: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        terminalKind: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        terminalKind: string | null;
    }, {
        id: string;
        title: string;
        terminalKind: string | null;
    }>, "many">;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        groupId: z.ZodString;
        kind: z.ZodEnum<["PREREQUISITE", "STATE", "TRANSITION", "TERMINAL", "VERIFY"]>;
        title: z.ZodString;
        description: z.ZodString;
        status: z.ZodEnum<["PENDING", "CURRENT", "DONE", "VERIFIED", "BLOCKED"]>;
        dependencies: z.ZodArray<z.ZodString, "many">;
        file: z.ZodNullable<z.ZodString>;
        symbol: z.ZodNullable<z.ZodString>;
        snippet: z.ZodString;
        eventType: z.ZodNullable<z.ZodString>;
        checkpointId: z.ZodNullable<z.ZodString>;
        userCompletedAt: z.ZodNullable<z.ZodString>;
        verificationEvidence: z.ZodArray<z.ZodAny, "many">;
    }, "strip", z.ZodTypeAny, {
        symbol: string | null;
        id: string;
        status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
        title: string;
        description: string;
        kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
        eventType: string | null;
        file: string | null;
        checkpointId: string | null;
        groupId: string;
        dependencies: string[];
        snippet: string;
        userCompletedAt: string | null;
        verificationEvidence: any[];
    }, {
        symbol: string | null;
        id: string;
        status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
        title: string;
        description: string;
        kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
        eventType: string | null;
        file: string | null;
        checkpointId: string | null;
        groupId: string;
        dependencies: string[];
        snippet: string;
        userCompletedAt: string | null;
        verificationEvidence: any[];
    }>, "many">;
    generatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: "1.0";
    revision: number;
    generatedAt: string;
    groups: {
        id: string;
        title: string;
        terminalKind: string | null;
    }[];
    steps: {
        symbol: string | null;
        id: string;
        status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
        title: string;
        description: string;
        kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
        eventType: string | null;
        file: string | null;
        checkpointId: string | null;
        groupId: string;
        dependencies: string[];
        snippet: string;
        userCompletedAt: string | null;
        verificationEvidence: any[];
    }[];
}, {
    version: "1.0";
    revision: number;
    generatedAt: string;
    groups: {
        id: string;
        title: string;
        terminalKind: string | null;
    }[];
    steps: {
        symbol: string | null;
        id: string;
        status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
        title: string;
        description: string;
        kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
        eventType: string | null;
        file: string | null;
        checkpointId: string | null;
        groupId: string;
        dependencies: string[];
        snippet: string;
        userCompletedAt: string | null;
        verificationEvidence: any[];
    }[];
}>;
export declare const CheckpointCoverageSchema: z.ZodObject<{
    status: z.ZodEnum<["NOT_STARTED", "WAITING_FOR_INITIAL", "RECORDING", "COMPLETED", "INCOMPLETE"]>;
    startedAt: z.ZodNullable<z.ZodString>;
    observedCheckpointIds: z.ZodArray<z.ZodString, "many">;
    missingCheckpointIds: z.ZodArray<z.ZodString, "many">;
    reachedTerminalStateIds: z.ZodArray<z.ZodString, "many">;
    orderingErrors: z.ZodArray<z.ZodAny, "many">;
    verifiedPath: z.ZodArray<z.ZodString, "many">;
    lastEventAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
    startedAt: string | null;
    observedCheckpointIds: string[];
    missingCheckpointIds: string[];
    reachedTerminalStateIds: string[];
    orderingErrors: any[];
    verifiedPath: string[];
    lastEventAt: string | null;
}, {
    status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
    startedAt: string | null;
    observedCheckpointIds: string[];
    missingCheckpointIds: string[];
    reachedTerminalStateIds: string[];
    orderingErrors: any[];
    verifiedPath: string[];
    lastEventAt: string | null;
}>;
export declare const FlowInitializationSchema: z.ZodObject<{
    id: z.ZodString;
    flowId: z.ZodString;
    flowVersionId: z.ZodString;
    bindingId: z.ZodString;
    scanId: z.ZodString;
    status: z.ZodEnum<["PROPOSED", "APPROVED", "APPLYING", "VALIDATING", "COMPLETED", "FAILED", "ROLLED_BACK"]>;
    mode: z.ZodNullable<z.ZodEnum<["AUTOMATED", "MANUAL"]>>;
    stage: z.ZodEnum<["SDK_REQUIRED", "SCANNING", "REVIEW_READY", "ROADMAP_READY", "AWAITING_APPROVAL", "APPLYING", "AWAITING_TELEMETRY", "COMPLETED", "FAILED"]>;
    manifestVersion: z.ZodString;
    manifest: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        graphVersionId: z.ZodString;
        graphHash: z.ZodString;
        repositorySnapshotId: z.ZodString;
        initialStateId: z.ZodString;
        terminalStateIds: z.ZodArray<z.ZodString, "many">;
        paths: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
        unreachableStateIds: z.ZodArray<z.ZodString, "many">;
        checkpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["STATE", "TRANSITION"]>;
            stateId: z.ZodNullable<z.ZodString>;
            transitionId: z.ZodNullable<z.ZodString>;
            stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodNullable<z.ZodString>;
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            fromCheckpointId: z.ZodNullable<z.ZodString>;
            toCheckpointId: z.ZodNullable<z.ZodString>;
            required: z.ZodBoolean;
            mapping: z.ZodObject<{
                file: z.ZodNullable<z.ZodString>;
                symbol: z.ZodNullable<z.ZodString>;
                confidence: z.ZodNumber;
                rationale: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }>>;
    reportProvenance: z.ZodNullable<z.ZodUnknown>;
    selectedTargetAdapters: z.ZodArray<z.ZodString, "many">;
    roadmapRevision: z.ZodNumber;
    manualRoadmap: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        revision: z.ZodNumber;
        groups: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            terminalKind: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            terminalKind: string | null;
        }, {
            id: string;
            title: string;
            terminalKind: string | null;
        }>, "many">;
        steps: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            groupId: z.ZodString;
            kind: z.ZodEnum<["PREREQUISITE", "STATE", "TRANSITION", "TERMINAL", "VERIFY"]>;
            title: z.ZodString;
            description: z.ZodString;
            status: z.ZodEnum<["PENDING", "CURRENT", "DONE", "VERIFIED", "BLOCKED"]>;
            dependencies: z.ZodArray<z.ZodString, "many">;
            file: z.ZodNullable<z.ZodString>;
            symbol: z.ZodNullable<z.ZodString>;
            snippet: z.ZodString;
            eventType: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodNullable<z.ZodString>;
            userCompletedAt: z.ZodNullable<z.ZodString>;
            verificationEvidence: z.ZodArray<z.ZodAny, "many">;
        }, "strip", z.ZodTypeAny, {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }, {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        revision: number;
        generatedAt: string;
        groups: {
            id: string;
            title: string;
            terminalKind: string | null;
        }[];
        steps: {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }[];
    }, {
        version: "1.0";
        revision: number;
        generatedAt: string;
        groups: {
            id: string;
            title: string;
            terminalKind: string | null;
        }[];
        steps: {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }[];
    }>>;
    verification: z.ZodNullable<z.ZodObject<{
        status: z.ZodEnum<["NOT_STARTED", "WAITING_FOR_INITIAL", "RECORDING", "COMPLETED", "INCOMPLETE"]>;
        startedAt: z.ZodNullable<z.ZodString>;
        observedCheckpointIds: z.ZodArray<z.ZodString, "many">;
        missingCheckpointIds: z.ZodArray<z.ZodString, "many">;
        reachedTerminalStateIds: z.ZodArray<z.ZodString, "many">;
        orderingErrors: z.ZodArray<z.ZodAny, "many">;
        verifiedPath: z.ZodArray<z.ZodString, "many">;
        lastEventAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
        startedAt: string | null;
        observedCheckpointIds: string[];
        missingCheckpointIds: string[];
        reachedTerminalStateIds: string[];
        orderingErrors: any[];
        verifiedPath: string[];
        lastEventAt: string | null;
    }, {
        status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
        startedAt: string | null;
        observedCheckpointIds: string[];
        missingCheckpointIds: string[];
        reachedTerminalStateIds: string[];
        orderingErrors: any[];
        verifiedPath: string[];
        lastEventAt: string | null;
    }>>;
    instrumentationPlanId: z.ZodNullable<z.ZodString>;
    patchSetId: z.ZodNullable<z.ZodString>;
    codeReviewReport: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        kind: z.ZodLiteral<"FLOW_CODE_REVIEW">;
        generatedAt: z.ZodString;
        engine: z.ZodEnum<["HYBRID", "RULES_FALLBACK"]>;
        summary: z.ZodObject<{
            mappedStates: z.ZodNumber;
            totalStates: z.ZodNumber;
            mappedTransitions: z.ZodNumber;
            totalTransitions: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        }, {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        }>;
        stateFindings: z.ZodArray<z.ZodAny, "many">;
        transitionFindings: z.ZodArray<z.ZodAny, "many">;
        missingStates: z.ZodArray<z.ZodAny, "many">;
        incompleteTransitions: z.ZodArray<z.ZodAny, "many">;
        edgeCases: z.ZodArray<z.ZodAny, "many">;
        uncoveredTerminalOutcomes: z.ZodArray<z.ZodAny, "many">;
        evidence: z.ZodArray<z.ZodAny, "many">;
        recommendations: z.ZodArray<z.ZodAny, "many">;
        limitations: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        evidence: any[];
        generatedAt: string;
        summary: {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        };
        kind: "FLOW_CODE_REVIEW";
        engine: "HYBRID" | "RULES_FALLBACK";
        stateFindings: any[];
        transitionFindings: any[];
        missingStates: any[];
        incompleteTransitions: any[];
        edgeCases: any[];
        uncoveredTerminalOutcomes: any[];
        recommendations: any[];
        limitations: string[];
    }, {
        version: "1.0";
        evidence: any[];
        generatedAt: string;
        summary: {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        };
        kind: "FLOW_CODE_REVIEW";
        engine: "HYBRID" | "RULES_FALLBACK";
        stateFindings: any[];
        transitionFindings: any[];
        missingStates: any[];
        incompleteTransitions: any[];
        edgeCases: any[];
        uncoveredTerminalOutcomes: any[];
        recommendations: any[];
        limitations: string[];
    }>>;
    validation: z.ZodNullable<z.ZodUnknown>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    flowId: z.ZodString;
    flowVersionId: z.ZodString;
    bindingId: z.ZodString;
    scanId: z.ZodString;
    status: z.ZodEnum<["PROPOSED", "APPROVED", "APPLYING", "VALIDATING", "COMPLETED", "FAILED", "ROLLED_BACK"]>;
    mode: z.ZodNullable<z.ZodEnum<["AUTOMATED", "MANUAL"]>>;
    stage: z.ZodEnum<["SDK_REQUIRED", "SCANNING", "REVIEW_READY", "ROADMAP_READY", "AWAITING_APPROVAL", "APPLYING", "AWAITING_TELEMETRY", "COMPLETED", "FAILED"]>;
    manifestVersion: z.ZodString;
    manifest: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        graphVersionId: z.ZodString;
        graphHash: z.ZodString;
        repositorySnapshotId: z.ZodString;
        initialStateId: z.ZodString;
        terminalStateIds: z.ZodArray<z.ZodString, "many">;
        paths: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
        unreachableStateIds: z.ZodArray<z.ZodString, "many">;
        checkpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["STATE", "TRANSITION"]>;
            stateId: z.ZodNullable<z.ZodString>;
            transitionId: z.ZodNullable<z.ZodString>;
            stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodNullable<z.ZodString>;
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            fromCheckpointId: z.ZodNullable<z.ZodString>;
            toCheckpointId: z.ZodNullable<z.ZodString>;
            required: z.ZodBoolean;
            mapping: z.ZodObject<{
                file: z.ZodNullable<z.ZodString>;
                symbol: z.ZodNullable<z.ZodString>;
                confidence: z.ZodNumber;
                rationale: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }>>;
    reportProvenance: z.ZodNullable<z.ZodUnknown>;
    selectedTargetAdapters: z.ZodArray<z.ZodString, "many">;
    roadmapRevision: z.ZodNumber;
    manualRoadmap: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        revision: z.ZodNumber;
        groups: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            terminalKind: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            terminalKind: string | null;
        }, {
            id: string;
            title: string;
            terminalKind: string | null;
        }>, "many">;
        steps: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            groupId: z.ZodString;
            kind: z.ZodEnum<["PREREQUISITE", "STATE", "TRANSITION", "TERMINAL", "VERIFY"]>;
            title: z.ZodString;
            description: z.ZodString;
            status: z.ZodEnum<["PENDING", "CURRENT", "DONE", "VERIFIED", "BLOCKED"]>;
            dependencies: z.ZodArray<z.ZodString, "many">;
            file: z.ZodNullable<z.ZodString>;
            symbol: z.ZodNullable<z.ZodString>;
            snippet: z.ZodString;
            eventType: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodNullable<z.ZodString>;
            userCompletedAt: z.ZodNullable<z.ZodString>;
            verificationEvidence: z.ZodArray<z.ZodAny, "many">;
        }, "strip", z.ZodTypeAny, {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }, {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        revision: number;
        generatedAt: string;
        groups: {
            id: string;
            title: string;
            terminalKind: string | null;
        }[];
        steps: {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }[];
    }, {
        version: "1.0";
        revision: number;
        generatedAt: string;
        groups: {
            id: string;
            title: string;
            terminalKind: string | null;
        }[];
        steps: {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }[];
    }>>;
    verification: z.ZodNullable<z.ZodObject<{
        status: z.ZodEnum<["NOT_STARTED", "WAITING_FOR_INITIAL", "RECORDING", "COMPLETED", "INCOMPLETE"]>;
        startedAt: z.ZodNullable<z.ZodString>;
        observedCheckpointIds: z.ZodArray<z.ZodString, "many">;
        missingCheckpointIds: z.ZodArray<z.ZodString, "many">;
        reachedTerminalStateIds: z.ZodArray<z.ZodString, "many">;
        orderingErrors: z.ZodArray<z.ZodAny, "many">;
        verifiedPath: z.ZodArray<z.ZodString, "many">;
        lastEventAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
        startedAt: string | null;
        observedCheckpointIds: string[];
        missingCheckpointIds: string[];
        reachedTerminalStateIds: string[];
        orderingErrors: any[];
        verifiedPath: string[];
        lastEventAt: string | null;
    }, {
        status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
        startedAt: string | null;
        observedCheckpointIds: string[];
        missingCheckpointIds: string[];
        reachedTerminalStateIds: string[];
        orderingErrors: any[];
        verifiedPath: string[];
        lastEventAt: string | null;
    }>>;
    instrumentationPlanId: z.ZodNullable<z.ZodString>;
    patchSetId: z.ZodNullable<z.ZodString>;
    codeReviewReport: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        kind: z.ZodLiteral<"FLOW_CODE_REVIEW">;
        generatedAt: z.ZodString;
        engine: z.ZodEnum<["HYBRID", "RULES_FALLBACK"]>;
        summary: z.ZodObject<{
            mappedStates: z.ZodNumber;
            totalStates: z.ZodNumber;
            mappedTransitions: z.ZodNumber;
            totalTransitions: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        }, {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        }>;
        stateFindings: z.ZodArray<z.ZodAny, "many">;
        transitionFindings: z.ZodArray<z.ZodAny, "many">;
        missingStates: z.ZodArray<z.ZodAny, "many">;
        incompleteTransitions: z.ZodArray<z.ZodAny, "many">;
        edgeCases: z.ZodArray<z.ZodAny, "many">;
        uncoveredTerminalOutcomes: z.ZodArray<z.ZodAny, "many">;
        evidence: z.ZodArray<z.ZodAny, "many">;
        recommendations: z.ZodArray<z.ZodAny, "many">;
        limitations: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        evidence: any[];
        generatedAt: string;
        summary: {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        };
        kind: "FLOW_CODE_REVIEW";
        engine: "HYBRID" | "RULES_FALLBACK";
        stateFindings: any[];
        transitionFindings: any[];
        missingStates: any[];
        incompleteTransitions: any[];
        edgeCases: any[];
        uncoveredTerminalOutcomes: any[];
        recommendations: any[];
        limitations: string[];
    }, {
        version: "1.0";
        evidence: any[];
        generatedAt: string;
        summary: {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        };
        kind: "FLOW_CODE_REVIEW";
        engine: "HYBRID" | "RULES_FALLBACK";
        stateFindings: any[];
        transitionFindings: any[];
        missingStates: any[];
        incompleteTransitions: any[];
        edgeCases: any[];
        uncoveredTerminalOutcomes: any[];
        recommendations: any[];
        limitations: string[];
    }>>;
    validation: z.ZodNullable<z.ZodUnknown>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    flowId: z.ZodString;
    flowVersionId: z.ZodString;
    bindingId: z.ZodString;
    scanId: z.ZodString;
    status: z.ZodEnum<["PROPOSED", "APPROVED", "APPLYING", "VALIDATING", "COMPLETED", "FAILED", "ROLLED_BACK"]>;
    mode: z.ZodNullable<z.ZodEnum<["AUTOMATED", "MANUAL"]>>;
    stage: z.ZodEnum<["SDK_REQUIRED", "SCANNING", "REVIEW_READY", "ROADMAP_READY", "AWAITING_APPROVAL", "APPLYING", "AWAITING_TELEMETRY", "COMPLETED", "FAILED"]>;
    manifestVersion: z.ZodString;
    manifest: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        graphVersionId: z.ZodString;
        graphHash: z.ZodString;
        repositorySnapshotId: z.ZodString;
        initialStateId: z.ZodString;
        terminalStateIds: z.ZodArray<z.ZodString, "many">;
        paths: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
        unreachableStateIds: z.ZodArray<z.ZodString, "many">;
        checkpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["STATE", "TRANSITION"]>;
            stateId: z.ZodNullable<z.ZodString>;
            transitionId: z.ZodNullable<z.ZodString>;
            stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodNullable<z.ZodString>;
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            fromCheckpointId: z.ZodNullable<z.ZodString>;
            toCheckpointId: z.ZodNullable<z.ZodString>;
            required: z.ZodBoolean;
            mapping: z.ZodObject<{
                file: z.ZodNullable<z.ZodString>;
                symbol: z.ZodNullable<z.ZodString>;
                confidence: z.ZodNumber;
                rationale: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }>>;
    reportProvenance: z.ZodNullable<z.ZodUnknown>;
    selectedTargetAdapters: z.ZodArray<z.ZodString, "many">;
    roadmapRevision: z.ZodNumber;
    manualRoadmap: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        revision: z.ZodNumber;
        groups: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            terminalKind: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            terminalKind: string | null;
        }, {
            id: string;
            title: string;
            terminalKind: string | null;
        }>, "many">;
        steps: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            groupId: z.ZodString;
            kind: z.ZodEnum<["PREREQUISITE", "STATE", "TRANSITION", "TERMINAL", "VERIFY"]>;
            title: z.ZodString;
            description: z.ZodString;
            status: z.ZodEnum<["PENDING", "CURRENT", "DONE", "VERIFIED", "BLOCKED"]>;
            dependencies: z.ZodArray<z.ZodString, "many">;
            file: z.ZodNullable<z.ZodString>;
            symbol: z.ZodNullable<z.ZodString>;
            snippet: z.ZodString;
            eventType: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodNullable<z.ZodString>;
            userCompletedAt: z.ZodNullable<z.ZodString>;
            verificationEvidence: z.ZodArray<z.ZodAny, "many">;
        }, "strip", z.ZodTypeAny, {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }, {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        revision: number;
        generatedAt: string;
        groups: {
            id: string;
            title: string;
            terminalKind: string | null;
        }[];
        steps: {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }[];
    }, {
        version: "1.0";
        revision: number;
        generatedAt: string;
        groups: {
            id: string;
            title: string;
            terminalKind: string | null;
        }[];
        steps: {
            symbol: string | null;
            id: string;
            status: "PENDING" | "CURRENT" | "DONE" | "VERIFIED" | "BLOCKED";
            title: string;
            description: string;
            kind: "TERMINAL" | "STATE" | "TRANSITION" | "PREREQUISITE" | "VERIFY";
            eventType: string | null;
            file: string | null;
            checkpointId: string | null;
            groupId: string;
            dependencies: string[];
            snippet: string;
            userCompletedAt: string | null;
            verificationEvidence: any[];
        }[];
    }>>;
    verification: z.ZodNullable<z.ZodObject<{
        status: z.ZodEnum<["NOT_STARTED", "WAITING_FOR_INITIAL", "RECORDING", "COMPLETED", "INCOMPLETE"]>;
        startedAt: z.ZodNullable<z.ZodString>;
        observedCheckpointIds: z.ZodArray<z.ZodString, "many">;
        missingCheckpointIds: z.ZodArray<z.ZodString, "many">;
        reachedTerminalStateIds: z.ZodArray<z.ZodString, "many">;
        orderingErrors: z.ZodArray<z.ZodAny, "many">;
        verifiedPath: z.ZodArray<z.ZodString, "many">;
        lastEventAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
        startedAt: string | null;
        observedCheckpointIds: string[];
        missingCheckpointIds: string[];
        reachedTerminalStateIds: string[];
        orderingErrors: any[];
        verifiedPath: string[];
        lastEventAt: string | null;
    }, {
        status: "WAITING_FOR_INITIAL" | "RECORDING" | "COMPLETED" | "NOT_STARTED" | "INCOMPLETE";
        startedAt: string | null;
        observedCheckpointIds: string[];
        missingCheckpointIds: string[];
        reachedTerminalStateIds: string[];
        orderingErrors: any[];
        verifiedPath: string[];
        lastEventAt: string | null;
    }>>;
    instrumentationPlanId: z.ZodNullable<z.ZodString>;
    patchSetId: z.ZodNullable<z.ZodString>;
    codeReviewReport: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        kind: z.ZodLiteral<"FLOW_CODE_REVIEW">;
        generatedAt: z.ZodString;
        engine: z.ZodEnum<["HYBRID", "RULES_FALLBACK"]>;
        summary: z.ZodObject<{
            mappedStates: z.ZodNumber;
            totalStates: z.ZodNumber;
            mappedTransitions: z.ZodNumber;
            totalTransitions: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        }, {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        }>;
        stateFindings: z.ZodArray<z.ZodAny, "many">;
        transitionFindings: z.ZodArray<z.ZodAny, "many">;
        missingStates: z.ZodArray<z.ZodAny, "many">;
        incompleteTransitions: z.ZodArray<z.ZodAny, "many">;
        edgeCases: z.ZodArray<z.ZodAny, "many">;
        uncoveredTerminalOutcomes: z.ZodArray<z.ZodAny, "many">;
        evidence: z.ZodArray<z.ZodAny, "many">;
        recommendations: z.ZodArray<z.ZodAny, "many">;
        limitations: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        evidence: any[];
        generatedAt: string;
        summary: {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        };
        kind: "FLOW_CODE_REVIEW";
        engine: "HYBRID" | "RULES_FALLBACK";
        stateFindings: any[];
        transitionFindings: any[];
        missingStates: any[];
        incompleteTransitions: any[];
        edgeCases: any[];
        uncoveredTerminalOutcomes: any[];
        recommendations: any[];
        limitations: string[];
    }, {
        version: "1.0";
        evidence: any[];
        generatedAt: string;
        summary: {
            mappedStates: number;
            totalStates: number;
            mappedTransitions: number;
            totalTransitions: number;
        };
        kind: "FLOW_CODE_REVIEW";
        engine: "HYBRID" | "RULES_FALLBACK";
        stateFindings: any[];
        transitionFindings: any[];
        missingStates: any[];
        incompleteTransitions: any[];
        edgeCases: any[];
        uncoveredTerminalOutcomes: any[];
        recommendations: any[];
        limitations: string[];
    }>>;
    validation: z.ZodNullable<z.ZodUnknown>;
}, z.ZodTypeAny, "passthrough">>;
export declare const SourceDocumentManifestSchema: z.ZodObject<{
    filename: z.ZodString;
    mimeType: z.ZodString;
    kind: z.ZodEnum<["PDF", "DOCX", "MARKDOWN", "TEXT", "HTML", "OPENAPI"]>;
    checksum: z.ZodString;
    processorVersion: z.ZodString;
    title: z.ZodString;
    summary: z.ZodString;
    structure: z.ZodUnknown;
    redaction: z.ZodObject<{
        riskLevel: z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>;
        redactions: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: string;
            count: number;
        }, {
            type: string;
            count: number;
        }>, "many">;
        promptInjectionDetected: z.ZodBoolean;
        excludedSegmentCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        riskLevel: "HIGH" | "MEDIUM" | "LOW";
        redactions: {
            type: string;
            count: number;
        }[];
        promptInjectionDetected: boolean;
        excludedSegmentCount: number;
    }, {
        riskLevel: "HIGH" | "MEDIUM" | "LOW";
        redactions: {
            type: string;
            count: number;
        }[];
        promptInjectionDetected: boolean;
        excludedSegmentCount: number;
    }>;
    segments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        heading: z.ZodNullable<z.ZodString>;
        excerpt: z.ZodString;
        locator: z.ZodString;
        confidence: z.ZodNumber;
        excludedFromAi: z.ZodBoolean;
        exclusionReason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        confidence: number;
        heading: string | null;
        excerpt: string;
        locator: string;
        excludedFromAi: boolean;
        exclusionReason?: string | undefined;
    }, {
        id: string;
        confidence: number;
        heading: string | null;
        excerpt: string;
        locator: string;
        excludedFromAi: boolean;
        exclusionReason?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    checksum: string;
    title: string;
    summary: string;
    kind: "PDF" | "DOCX" | "MARKDOWN" | "TEXT" | "HTML" | "OPENAPI";
    filename: string;
    mimeType: string;
    processorVersion: string;
    redaction: {
        riskLevel: "HIGH" | "MEDIUM" | "LOW";
        redactions: {
            type: string;
            count: number;
        }[];
        promptInjectionDetected: boolean;
        excludedSegmentCount: number;
    };
    segments: {
        id: string;
        confidence: number;
        heading: string | null;
        excerpt: string;
        locator: string;
        excludedFromAi: boolean;
        exclusionReason?: string | undefined;
    }[];
    structure?: unknown;
}, {
    checksum: string;
    title: string;
    summary: string;
    kind: "PDF" | "DOCX" | "MARKDOWN" | "TEXT" | "HTML" | "OPENAPI";
    filename: string;
    mimeType: string;
    processorVersion: string;
    redaction: {
        riskLevel: "HIGH" | "MEDIUM" | "LOW";
        redactions: {
            type: string;
            count: number;
        }[];
        promptInjectionDetected: boolean;
        excludedSegmentCount: number;
    };
    segments: {
        id: string;
        confidence: number;
        heading: string | null;
        excerpt: string;
        locator: string;
        excludedFromAi: boolean;
        exclusionReason?: string | undefined;
    }[];
    structure?: unknown;
}>;
export declare const SourceDocumentSummarySchema: z.ZodObject<{
    id: z.ZodString;
    filename: z.ZodString;
    mimeType: z.ZodString;
    checksum: z.ZodString;
    uploadMode: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        extractedSummary: z.ZodUnknown;
        redactionSummary: z.ZodUnknown;
        structureSummary: z.ZodNullable<z.ZodUnknown>;
        processorVersion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        processorVersion: string;
        redactionSummary?: unknown;
        extractedSummary?: unknown;
        structureSummary?: unknown;
    }, {
        id: string;
        version: number;
        processorVersion: string;
        redactionSummary?: unknown;
        extractedSummary?: unknown;
        structureSummary?: unknown;
    }>, "many">>;
    processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodString;
        resultVersionId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: string;
        resultVersionId: string | null;
    }, {
        id: string;
        status: string;
        resultVersionId: string | null;
    }>, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    filename: z.ZodString;
    mimeType: z.ZodString;
    checksum: z.ZodString;
    uploadMode: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        extractedSummary: z.ZodUnknown;
        redactionSummary: z.ZodUnknown;
        structureSummary: z.ZodNullable<z.ZodUnknown>;
        processorVersion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        processorVersion: string;
        redactionSummary?: unknown;
        extractedSummary?: unknown;
        structureSummary?: unknown;
    }, {
        id: string;
        version: number;
        processorVersion: string;
        redactionSummary?: unknown;
        extractedSummary?: unknown;
        structureSummary?: unknown;
    }>, "many">>;
    processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodString;
        resultVersionId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: string;
        resultVersionId: string | null;
    }, {
        id: string;
        status: string;
        resultVersionId: string | null;
    }>, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    filename: z.ZodString;
    mimeType: z.ZodString;
    checksum: z.ZodString;
    uploadMode: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        extractedSummary: z.ZodUnknown;
        redactionSummary: z.ZodUnknown;
        structureSummary: z.ZodNullable<z.ZodUnknown>;
        processorVersion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        processorVersion: string;
        redactionSummary?: unknown;
        extractedSummary?: unknown;
        structureSummary?: unknown;
    }, {
        id: string;
        version: number;
        processorVersion: string;
        redactionSummary?: unknown;
        extractedSummary?: unknown;
        structureSummary?: unknown;
    }>, "many">>;
    processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodString;
        resultVersionId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: string;
        resultVersionId: string | null;
    }, {
        id: string;
        status: string;
        resultVersionId: string | null;
    }>, "many">>;
}, z.ZodTypeAny, "passthrough">>;
export declare const DocumentAccessSchema: z.ZodObject<{
    entitled: z.ZodBoolean;
    documents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        checksum: z.ZodString;
        uploadMode: z.ZodString;
        status: z.ZodString;
        createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            version: z.ZodNumber;
            extractedSummary: z.ZodUnknown;
            redactionSummary: z.ZodUnknown;
            structureSummary: z.ZodNullable<z.ZodUnknown>;
            processorVersion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }>, "many">>;
        processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodString;
            resultVersionId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }>, "many">>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        checksum: z.ZodString;
        uploadMode: z.ZodString;
        status: z.ZodString;
        createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            version: z.ZodNumber;
            extractedSummary: z.ZodUnknown;
            redactionSummary: z.ZodUnknown;
            structureSummary: z.ZodNullable<z.ZodUnknown>;
            processorVersion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }>, "many">>;
        processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodString;
            resultVersionId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }>, "many">>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        checksum: z.ZodString;
        uploadMode: z.ZodString;
        status: z.ZodString;
        createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            version: z.ZodNumber;
            extractedSummary: z.ZodUnknown;
            redactionSummary: z.ZodUnknown;
            structureSummary: z.ZodNullable<z.ZodUnknown>;
            processorVersion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }>, "many">>;
        processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodString;
            resultVersionId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }>, "many">>;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    accessDenied: z.ZodOptional<z.ZodBoolean>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entitled: boolean;
    documents: z.objectOutputType<{
        id: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        checksum: z.ZodString;
        uploadMode: z.ZodString;
        status: z.ZodString;
        createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            version: z.ZodNumber;
            extractedSummary: z.ZodUnknown;
            redactionSummary: z.ZodUnknown;
            structureSummary: z.ZodNullable<z.ZodUnknown>;
            processorVersion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }>, "many">>;
        processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodString;
            resultVersionId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }>, "many">>;
    }, z.ZodTypeAny, "passthrough">[];
    message?: string | undefined;
    accessDenied?: boolean | undefined;
}, {
    entitled: boolean;
    documents: z.objectInputType<{
        id: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        checksum: z.ZodString;
        uploadMode: z.ZodString;
        status: z.ZodString;
        createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        versions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            version: z.ZodNumber;
            extractedSummary: z.ZodUnknown;
            redactionSummary: z.ZodUnknown;
            structureSummary: z.ZodNullable<z.ZodUnknown>;
            processorVersion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }, {
            id: string;
            version: number;
            processorVersion: string;
            redactionSummary?: unknown;
            extractedSummary?: unknown;
            structureSummary?: unknown;
        }>, "many">>;
        processingJobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodString;
            resultVersionId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }, {
            id: string;
            status: string;
            resultVersionId: string | null;
        }>, "many">>;
    }, z.ZodTypeAny, "passthrough">[];
    message?: string | undefined;
    accessDenied?: boolean | undefined;
}>;
export declare const AsyncJobStatusSchema: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
export declare const DocumentImportResultSchema: z.ZodObject<{
    filename: z.ZodString;
    documentId: z.ZodNullable<z.ZodString>;
    jobId: z.ZodNullable<z.ZodString>;
    status: z.ZodUnion<[z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>, z.ZodLiteral<"PROCESSED">]>;
    deduplicated: z.ZodDefault<z.ZodBoolean>;
    versionId: z.ZodNullable<z.ZodString>;
    errorMessageSafe: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "QUEUED" | "PROCESSED";
    versionId: string | null;
    filename: string;
    documentId: string | null;
    jobId: string | null;
    deduplicated: boolean;
    errorMessageSafe: string | null;
}, {
    status: "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "QUEUED" | "PROCESSED";
    versionId: string | null;
    filename: string;
    documentId: string | null;
    jobId: string | null;
    deduplicated?: boolean | undefined;
    errorMessageSafe?: string | null | undefined;
}>;
export declare const DocumentProcessingJobSchema: z.ZodObject<{
    id: z.ZodString;
    documentId: z.ZodString;
    status: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
    resultVersionId: z.ZodNullable<z.ZodString>;
    errorMessageSafe: z.ZodNullable<z.ZodString>;
    attempts: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    scheduledAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    documentId: z.ZodString;
    status: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
    resultVersionId: z.ZodNullable<z.ZodString>;
    errorMessageSafe: z.ZodNullable<z.ZodString>;
    attempts: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    scheduledAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    documentId: z.ZodString;
    status: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
    resultVersionId: z.ZodNullable<z.ZodString>;
    errorMessageSafe: z.ZodNullable<z.ZodString>;
    attempts: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    scheduledAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const IntentDraftJobSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
    draftId: z.ZodNullable<z.ZodString>;
    errorMessageSafe: z.ZodNullable<z.ZodString>;
    attempts: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    scheduledAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    status: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
    draftId: z.ZodNullable<z.ZodString>;
    errorMessageSafe: z.ZodNullable<z.ZodString>;
    attempts: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    scheduledAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    status: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
    draftId: z.ZodNullable<z.ZodString>;
    errorMessageSafe: z.ZodNullable<z.ZodString>;
    attempts: z.ZodNumber;
    maxAttempts: z.ZodNumber;
    scheduledAt: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    startedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    completedAt: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const IntentDraftJobCreatedSchema: z.ZodObject<{
    jobId: z.ZodString;
    status: z.ZodEnum<["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
}, "strip", z.ZodTypeAny, {
    status: "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "QUEUED";
    jobId: string;
}, {
    status: "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "QUEUED";
    jobId: string;
}>;
export declare const IntentDraftSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodString;
    source: z.ZodString;
    confidence: z.ZodNumber;
    draftJson: z.ZodAny;
    sourceManifest: z.ZodNullable<z.ZodAny>;
    acceptedGraphId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    acceptedGraphVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    evidence: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    status: z.ZodString;
    source: z.ZodString;
    confidence: z.ZodNumber;
    draftJson: z.ZodAny;
    sourceManifest: z.ZodNullable<z.ZodAny>;
    acceptedGraphId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    acceptedGraphVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    evidence: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    status: z.ZodString;
    source: z.ZodString;
    confidence: z.ZodNumber;
    draftJson: z.ZodAny;
    sourceManifest: z.ZodNullable<z.ZodAny>;
    acceptedGraphId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    acceptedGraphVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    evidence: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, z.ZodTypeAny, "passthrough">>;
export declare const InstrumentationFrameworkIdSchema: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
export declare const SdkTargetKindSchema: z.ZodEnum<["FRONTEND", "BACKEND"]>;
export declare const SdkConnectionMethodSchema: z.ZodEnum<["MANUAL", "DESKTOP"]>;
export declare const SdkTargetReadinessSchema: z.ZodObject<{
    targetId: z.ZodString;
    kind: z.ZodEnum<["FRONTEND", "BACKEND"]>;
    source: z.ZodString;
    configured: z.ZodDefault<z.ZodBoolean>;
    processHealthy: z.ZodBoolean;
    sessionObserved: z.ZodBoolean;
    eventObserved: z.ZodBoolean;
    installationTestPassed: z.ZodBoolean;
    verified: z.ZodBoolean;
    lastEventAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: string;
    kind: "FRONTEND" | "BACKEND";
    lastEventAt: string | null;
    targetId: string;
    configured: boolean;
    processHealthy: boolean;
    sessionObserved: boolean;
    eventObserved: boolean;
    installationTestPassed: boolean;
    verified: boolean;
}, {
    source: string;
    kind: "FRONTEND" | "BACKEND";
    lastEventAt: string | null;
    targetId: string;
    processHealthy: boolean;
    sessionObserved: boolean;
    eventObserved: boolean;
    installationTestPassed: boolean;
    verified: boolean;
    configured?: boolean | undefined;
}>;
export declare const SdkReadinessSchema: z.ZodObject<{
    applicationId: z.ZodString;
    environmentId: z.ZodString;
    connected: z.ZodBoolean;
    codeConfigured: z.ZodDefault<z.ZodBoolean>;
    readyForDemonstration: z.ZodBoolean;
    sessionObserved: z.ZodBoolean;
    eventObserved: z.ZodBoolean;
    installationTestPassed: z.ZodBoolean;
    targets: z.ZodArray<z.ZodObject<{
        targetId: z.ZodString;
        kind: z.ZodEnum<["FRONTEND", "BACKEND"]>;
        source: z.ZodString;
        configured: z.ZodDefault<z.ZodBoolean>;
        processHealthy: z.ZodBoolean;
        sessionObserved: z.ZodBoolean;
        eventObserved: z.ZodBoolean;
        installationTestPassed: z.ZodBoolean;
        verified: z.ZodBoolean;
        lastEventAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source: string;
        kind: "FRONTEND" | "BACKEND";
        lastEventAt: string | null;
        targetId: string;
        configured: boolean;
        processHealthy: boolean;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        verified: boolean;
    }, {
        source: string;
        kind: "FRONTEND" | "BACKEND";
        lastEventAt: string | null;
        targetId: string;
        processHealthy: boolean;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        verified: boolean;
        configured?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    applicationId: string;
    environmentId: string;
    sessionObserved: boolean;
    eventObserved: boolean;
    installationTestPassed: boolean;
    connected: boolean;
    codeConfigured: boolean;
    readyForDemonstration: boolean;
    targets: {
        source: string;
        kind: "FRONTEND" | "BACKEND";
        lastEventAt: string | null;
        targetId: string;
        configured: boolean;
        processHealthy: boolean;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        verified: boolean;
    }[];
}, {
    applicationId: string;
    environmentId: string;
    sessionObserved: boolean;
    eventObserved: boolean;
    installationTestPassed: boolean;
    connected: boolean;
    readyForDemonstration: boolean;
    targets: {
        source: string;
        kind: "FRONTEND" | "BACKEND";
        lastEventAt: string | null;
        targetId: string;
        processHealthy: boolean;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        verified: boolean;
        configured?: boolean | undefined;
    }[];
    codeConfigured?: boolean | undefined;
}>;
export declare const SdkSetupTargetSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["FRONTEND", "BACKEND"]>;
    label: z.ZodString;
    packageName: z.ZodEnum<["@tellann/frontend-sdk", "@tellann/backend-sdk"]>;
    packageVersion: z.ZodString;
    installCommands: z.ZodRecord<z.ZodString, z.ZodString>;
    environmentVariables: z.ZodRecord<z.ZodString, z.ZodString>;
    snippet: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    kind: "FRONTEND" | "BACKEND";
    snippet: string;
    packageName: "@tellann/frontend-sdk" | "@tellann/backend-sdk";
    packageVersion: string;
    installCommands: Record<string, string>;
    environmentVariables: Record<string, string>;
}, {
    id: string;
    label: string;
    kind: "FRONTEND" | "BACKEND";
    snippet: string;
    packageName: "@tellann/frontend-sdk" | "@tellann/backend-sdk";
    packageVersion: string;
    installCommands: Record<string, string>;
    environmentVariables: Record<string, string>;
}>;
export declare const SdkSetupDescriptorSchema: z.ZodObject<{
    applicationId: z.ZodString;
    applicationName: z.ZodString;
    organizationId: z.ZodString;
    environmentId: z.ZodString;
    environmentName: z.ZodString;
    environmentType: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
    baseUrl: z.ZodNullable<z.ZodString>;
    gatewayEndpoint: z.ZodString;
    gatewayEndpointCustomized: z.ZodDefault<z.ZodBoolean>;
    hasActiveKey: z.ZodBoolean;
    keyPrefix: z.ZodNullable<z.ZodString>;
    targets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["FRONTEND", "BACKEND"]>;
        label: z.ZodString;
        packageName: z.ZodEnum<["@tellann/frontend-sdk", "@tellann/backend-sdk"]>;
        packageVersion: z.ZodString;
        installCommands: z.ZodRecord<z.ZodString, z.ZodString>;
        environmentVariables: z.ZodRecord<z.ZodString, z.ZodString>;
        snippet: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        kind: "FRONTEND" | "BACKEND";
        snippet: string;
        packageName: "@tellann/frontend-sdk" | "@tellann/backend-sdk";
        packageVersion: string;
        installCommands: Record<string, string>;
        environmentVariables: Record<string, string>;
    }, {
        id: string;
        label: string;
        kind: "FRONTEND" | "BACKEND";
        snippet: string;
        packageName: "@tellann/frontend-sdk" | "@tellann/backend-sdk";
        packageVersion: string;
        installCommands: Record<string, string>;
        environmentVariables: Record<string, string>;
    }>, "many">;
    readiness: z.ZodObject<{
        applicationId: z.ZodString;
        environmentId: z.ZodString;
        connected: z.ZodBoolean;
        codeConfigured: z.ZodDefault<z.ZodBoolean>;
        readyForDemonstration: z.ZodBoolean;
        sessionObserved: z.ZodBoolean;
        eventObserved: z.ZodBoolean;
        installationTestPassed: z.ZodBoolean;
        targets: z.ZodArray<z.ZodObject<{
            targetId: z.ZodString;
            kind: z.ZodEnum<["FRONTEND", "BACKEND"]>;
            source: z.ZodString;
            configured: z.ZodDefault<z.ZodBoolean>;
            processHealthy: z.ZodBoolean;
            sessionObserved: z.ZodBoolean;
            eventObserved: z.ZodBoolean;
            installationTestPassed: z.ZodBoolean;
            verified: z.ZodBoolean;
            lastEventAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            source: string;
            kind: "FRONTEND" | "BACKEND";
            lastEventAt: string | null;
            targetId: string;
            configured: boolean;
            processHealthy: boolean;
            sessionObserved: boolean;
            eventObserved: boolean;
            installationTestPassed: boolean;
            verified: boolean;
        }, {
            source: string;
            kind: "FRONTEND" | "BACKEND";
            lastEventAt: string | null;
            targetId: string;
            processHealthy: boolean;
            sessionObserved: boolean;
            eventObserved: boolean;
            installationTestPassed: boolean;
            verified: boolean;
            configured?: boolean | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        applicationId: string;
        environmentId: string;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        connected: boolean;
        codeConfigured: boolean;
        readyForDemonstration: boolean;
        targets: {
            source: string;
            kind: "FRONTEND" | "BACKEND";
            lastEventAt: string | null;
            targetId: string;
            configured: boolean;
            processHealthy: boolean;
            sessionObserved: boolean;
            eventObserved: boolean;
            installationTestPassed: boolean;
            verified: boolean;
        }[];
    }, {
        applicationId: string;
        environmentId: string;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        connected: boolean;
        readyForDemonstration: boolean;
        targets: {
            source: string;
            kind: "FRONTEND" | "BACKEND";
            lastEventAt: string | null;
            targetId: string;
            processHealthy: boolean;
            sessionObserved: boolean;
            eventObserved: boolean;
            installationTestPassed: boolean;
            verified: boolean;
            configured?: boolean | undefined;
        }[];
        codeConfigured?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    applicationId: string;
    environmentId: string;
    targets: {
        id: string;
        label: string;
        kind: "FRONTEND" | "BACKEND";
        snippet: string;
        packageName: "@tellann/frontend-sdk" | "@tellann/backend-sdk";
        packageVersion: string;
        installCommands: Record<string, string>;
        environmentVariables: Record<string, string>;
    }[];
    applicationName: string;
    organizationId: string;
    environmentName: string;
    environmentType: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
    baseUrl: string | null;
    gatewayEndpoint: string;
    gatewayEndpointCustomized: boolean;
    hasActiveKey: boolean;
    keyPrefix: string | null;
    readiness: {
        applicationId: string;
        environmentId: string;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        connected: boolean;
        codeConfigured: boolean;
        readyForDemonstration: boolean;
        targets: {
            source: string;
            kind: "FRONTEND" | "BACKEND";
            lastEventAt: string | null;
            targetId: string;
            configured: boolean;
            processHealthy: boolean;
            sessionObserved: boolean;
            eventObserved: boolean;
            installationTestPassed: boolean;
            verified: boolean;
        }[];
    };
}, {
    applicationId: string;
    environmentId: string;
    targets: {
        id: string;
        label: string;
        kind: "FRONTEND" | "BACKEND";
        snippet: string;
        packageName: "@tellann/frontend-sdk" | "@tellann/backend-sdk";
        packageVersion: string;
        installCommands: Record<string, string>;
        environmentVariables: Record<string, string>;
    }[];
    applicationName: string;
    organizationId: string;
    environmentName: string;
    environmentType: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
    baseUrl: string | null;
    gatewayEndpoint: string;
    hasActiveKey: boolean;
    keyPrefix: string | null;
    readiness: {
        applicationId: string;
        environmentId: string;
        sessionObserved: boolean;
        eventObserved: boolean;
        installationTestPassed: boolean;
        connected: boolean;
        readyForDemonstration: boolean;
        targets: {
            source: string;
            kind: "FRONTEND" | "BACKEND";
            lastEventAt: string | null;
            targetId: string;
            processHealthy: boolean;
            sessionObserved: boolean;
            eventObserved: boolean;
            installationTestPassed: boolean;
            verified: boolean;
            configured?: boolean | undefined;
        }[];
        codeConfigured?: boolean | undefined;
    };
    gatewayEndpointCustomized?: boolean | undefined;
}>;
export declare const DesktopSetupHandoffSchema: z.ZodObject<{
    handoffToken: z.ZodString;
    expiresAt: z.ZodString;
    deepLink: z.ZodString;
    applicationId: z.ZodString;
    environmentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresAt: string;
    applicationId: string;
    environmentId: string;
    handoffToken: string;
    deepLink: string;
}, {
    expiresAt: string;
    applicationId: string;
    environmentId: string;
    handoffToken: string;
    deepLink: string;
}>;
export declare const InstrumentationPlanStatusSchema: z.ZodEnum<["PROPOSED", "APPROVED", "APPLYING", "APPLIED", "VALIDATING", "COMPLETED", "VALIDATION_FAILED", "STALE", "REJECTED", "FAILED", "ROLLED_BACK"]>;
export declare const StructuredInstrumentationCommandSchema: z.ZodObject<{
    id: z.ZodString;
    executable: z.ZodString;
    args: z.ZodArray<z.ZodString, "many">;
    cwd: z.ZodString;
    timeoutMs: z.ZodNumber;
    allowedEnvironmentKeys: z.ZodArray<z.ZodString, "many">;
    purpose: z.ZodString;
    networkRequired: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    purpose: string;
    executable: string;
    args: string[];
    cwd: string;
    timeoutMs: number;
    allowedEnvironmentKeys: string[];
    networkRequired: boolean;
}, {
    id: string;
    purpose: string;
    executable: string;
    args: string[];
    cwd: string;
    timeoutMs: number;
    allowedEnvironmentKeys: string[];
    networkRequired: boolean;
}>;
export declare const InstrumentationOperationSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
    relativePath: z.ZodString;
    symbol: z.ZodNullable<z.ZodString>;
    transformId: z.ZodString;
    transformVersion: z.ZodString;
    expectedHash: z.ZodNullable<z.ZodString>;
    description: z.ZodString;
    eventMappings: z.ZodArray<z.ZodObject<{
        eventType: z.ZodString;
        expectedState: z.ZodNullable<z.ZodString>;
        checkpointId: z.ZodOptional<z.ZodString>;
        stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        eventType: string;
        expectedState: string | null;
        terminalKind?: string | null | undefined;
        stateId?: string | null | undefined;
        transitionId?: string | null | undefined;
        checkpointId?: string | undefined;
    }, {
        eventType: string;
        expectedState: string | null;
        terminalKind?: string | null | undefined;
        stateId?: string | null | undefined;
        transitionId?: string | null | undefined;
        checkpointId?: string | undefined;
    }>, "many">;
    flowInitializationId: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
    relativePath: z.ZodString;
    symbol: z.ZodNullable<z.ZodString>;
    transformId: z.ZodString;
    transformVersion: z.ZodString;
    expectedHash: z.ZodNullable<z.ZodString>;
    description: z.ZodString;
    eventMappings: z.ZodArray<z.ZodObject<{
        eventType: z.ZodString;
        expectedState: z.ZodNullable<z.ZodString>;
        checkpointId: z.ZodOptional<z.ZodString>;
        stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        eventType: string;
        expectedState: string | null;
        terminalKind?: string | null | undefined;
        stateId?: string | null | undefined;
        transitionId?: string | null | undefined;
        checkpointId?: string | undefined;
    }, {
        eventType: string;
        expectedState: string | null;
        terminalKind?: string | null | undefined;
        stateId?: string | null | undefined;
        transitionId?: string | null | undefined;
        checkpointId?: string | undefined;
    }>, "many">;
    flowInitializationId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
    relativePath: z.ZodString;
    symbol: z.ZodNullable<z.ZodString>;
    transformId: z.ZodString;
    transformVersion: z.ZodString;
    expectedHash: z.ZodNullable<z.ZodString>;
    description: z.ZodString;
    eventMappings: z.ZodArray<z.ZodObject<{
        eventType: z.ZodString;
        expectedState: z.ZodNullable<z.ZodString>;
        checkpointId: z.ZodOptional<z.ZodString>;
        stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        eventType: string;
        expectedState: string | null;
        terminalKind?: string | null | undefined;
        stateId?: string | null | undefined;
        transitionId?: string | null | undefined;
        checkpointId?: string | undefined;
    }, {
        eventType: string;
        expectedState: string | null;
        terminalKind?: string | null | undefined;
        stateId?: string | null | undefined;
        transitionId?: string | null | undefined;
        checkpointId?: string | undefined;
    }>, "many">;
    flowInitializationId: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const InstrumentationPlanSchema: z.ZodObject<{
    contractVersion: z.ZodString;
    manifestVersion: z.ZodString;
    id: z.ZodString;
    taskKey: z.ZodString;
    adapterId: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
    adapterVersion: z.ZodString;
    frameworkVersion: z.ZodNullable<z.ZodString>;
    supportedVersionRange: z.ZodString;
    baseRevision: z.ZodNullable<z.ZodString>;
    repositoryFingerprint: z.ZodString;
    approvedFileScopes: z.ZodArray<z.ZodString, "many">;
    packageChanges: z.ZodArray<z.ZodObject<{
        packageName: z.ZodString;
        version: z.ZodString;
        kind: z.ZodEnum<["dependency", "devDependency"]>;
    }, "strip", z.ZodTypeAny, {
        version: string;
        kind: "dependency" | "devDependency";
        packageName: string;
    }, {
        version: string;
        kind: "dependency" | "devDependency";
        packageName: string;
    }>, "many">;
    operations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    validationCommands: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        executable: z.ZodString;
        args: z.ZodArray<z.ZodString, "many">;
        cwd: z.ZodString;
        timeoutMs: z.ZodNumber;
        allowedEnvironmentKeys: z.ZodArray<z.ZodString, "many">;
        purpose: z.ZodString;
        networkRequired: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        purpose: string;
        executable: string;
        args: string[];
        cwd: string;
        timeoutMs: number;
        allowedEnvironmentKeys: string[];
        networkRequired: boolean;
    }, {
        id: string;
        purpose: string;
        executable: string;
        args: string[];
        cwd: string;
        timeoutMs: number;
        allowedEnvironmentKeys: string[];
        networkRequired: boolean;
    }>, "many">;
    networkRequirements: z.ZodArray<z.ZodString, "many">;
    risk: z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>;
    riskReasons: z.ZodArray<z.ZodString, "many">;
    evidence: z.ZodAny;
    createdAt: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["PROPOSED", "APPROVED", "APPLYING", "APPLIED", "VALIDATING", "COMPLETED", "VALIDATION_FAILED", "STALE", "REJECTED", "FAILED", "ROLLED_BACK"]>>;
    instrumentationPurpose: z.ZodDefault<z.ZodEnum<["BOOTSTRAP", "FLOW"]>>;
    flowId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowInitializationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowManifest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        graphVersionId: z.ZodString;
        graphHash: z.ZodString;
        repositorySnapshotId: z.ZodString;
        initialStateId: z.ZodString;
        terminalStateIds: z.ZodArray<z.ZodString, "many">;
        paths: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
        unreachableStateIds: z.ZodArray<z.ZodString, "many">;
        checkpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["STATE", "TRANSITION"]>;
            stateId: z.ZodNullable<z.ZodString>;
            transitionId: z.ZodNullable<z.ZodString>;
            stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodNullable<z.ZodString>;
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            fromCheckpointId: z.ZodNullable<z.ZodString>;
            toCheckpointId: z.ZodNullable<z.ZodString>;
            required: z.ZodBoolean;
            mapping: z.ZodObject<{
                file: z.ZodNullable<z.ZodString>;
                symbol: z.ZodNullable<z.ZodString>;
                confidence: z.ZodNumber;
                rationale: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }>>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    contractVersion: z.ZodString;
    manifestVersion: z.ZodString;
    id: z.ZodString;
    taskKey: z.ZodString;
    adapterId: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
    adapterVersion: z.ZodString;
    frameworkVersion: z.ZodNullable<z.ZodString>;
    supportedVersionRange: z.ZodString;
    baseRevision: z.ZodNullable<z.ZodString>;
    repositoryFingerprint: z.ZodString;
    approvedFileScopes: z.ZodArray<z.ZodString, "many">;
    packageChanges: z.ZodArray<z.ZodObject<{
        packageName: z.ZodString;
        version: z.ZodString;
        kind: z.ZodEnum<["dependency", "devDependency"]>;
    }, "strip", z.ZodTypeAny, {
        version: string;
        kind: "dependency" | "devDependency";
        packageName: string;
    }, {
        version: string;
        kind: "dependency" | "devDependency";
        packageName: string;
    }>, "many">;
    operations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    validationCommands: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        executable: z.ZodString;
        args: z.ZodArray<z.ZodString, "many">;
        cwd: z.ZodString;
        timeoutMs: z.ZodNumber;
        allowedEnvironmentKeys: z.ZodArray<z.ZodString, "many">;
        purpose: z.ZodString;
        networkRequired: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        purpose: string;
        executable: string;
        args: string[];
        cwd: string;
        timeoutMs: number;
        allowedEnvironmentKeys: string[];
        networkRequired: boolean;
    }, {
        id: string;
        purpose: string;
        executable: string;
        args: string[];
        cwd: string;
        timeoutMs: number;
        allowedEnvironmentKeys: string[];
        networkRequired: boolean;
    }>, "many">;
    networkRequirements: z.ZodArray<z.ZodString, "many">;
    risk: z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>;
    riskReasons: z.ZodArray<z.ZodString, "many">;
    evidence: z.ZodAny;
    createdAt: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["PROPOSED", "APPROVED", "APPLYING", "APPLIED", "VALIDATING", "COMPLETED", "VALIDATION_FAILED", "STALE", "REJECTED", "FAILED", "ROLLED_BACK"]>>;
    instrumentationPurpose: z.ZodDefault<z.ZodEnum<["BOOTSTRAP", "FLOW"]>>;
    flowId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowInitializationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowManifest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        graphVersionId: z.ZodString;
        graphHash: z.ZodString;
        repositorySnapshotId: z.ZodString;
        initialStateId: z.ZodString;
        terminalStateIds: z.ZodArray<z.ZodString, "many">;
        paths: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
        unreachableStateIds: z.ZodArray<z.ZodString, "many">;
        checkpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["STATE", "TRANSITION"]>;
            stateId: z.ZodNullable<z.ZodString>;
            transitionId: z.ZodNullable<z.ZodString>;
            stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodNullable<z.ZodString>;
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            fromCheckpointId: z.ZodNullable<z.ZodString>;
            toCheckpointId: z.ZodNullable<z.ZodString>;
            required: z.ZodBoolean;
            mapping: z.ZodObject<{
                file: z.ZodNullable<z.ZodString>;
                symbol: z.ZodNullable<z.ZodString>;
                confidence: z.ZodNumber;
                rationale: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }>>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    contractVersion: z.ZodString;
    manifestVersion: z.ZodString;
    id: z.ZodString;
    taskKey: z.ZodString;
    adapterId: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
    adapterVersion: z.ZodString;
    frameworkVersion: z.ZodNullable<z.ZodString>;
    supportedVersionRange: z.ZodString;
    baseRevision: z.ZodNullable<z.ZodString>;
    repositoryFingerprint: z.ZodString;
    approvedFileScopes: z.ZodArray<z.ZodString, "many">;
    packageChanges: z.ZodArray<z.ZodObject<{
        packageName: z.ZodString;
        version: z.ZodString;
        kind: z.ZodEnum<["dependency", "devDependency"]>;
    }, "strip", z.ZodTypeAny, {
        version: string;
        kind: "dependency" | "devDependency";
        packageName: string;
    }, {
        version: string;
        kind: "dependency" | "devDependency";
        packageName: string;
    }>, "many">;
    operations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        kind: z.ZodEnum<["CREATE_FILE", "UPDATE_SOURCE", "UPDATE_PACKAGE"]>;
        relativePath: z.ZodString;
        symbol: z.ZodNullable<z.ZodString>;
        transformId: z.ZodString;
        transformVersion: z.ZodString;
        expectedHash: z.ZodNullable<z.ZodString>;
        description: z.ZodString;
        eventMappings: z.ZodArray<z.ZodObject<{
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            checkpointId: z.ZodOptional<z.ZodString>;
            stateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            transitionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            terminalKind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }, {
            eventType: string;
            expectedState: string | null;
            terminalKind?: string | null | undefined;
            stateId?: string | null | undefined;
            transitionId?: string | null | undefined;
            checkpointId?: string | undefined;
        }>, "many">;
        flowInitializationId: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, "many">;
    validationCommands: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        executable: z.ZodString;
        args: z.ZodArray<z.ZodString, "many">;
        cwd: z.ZodString;
        timeoutMs: z.ZodNumber;
        allowedEnvironmentKeys: z.ZodArray<z.ZodString, "many">;
        purpose: z.ZodString;
        networkRequired: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        purpose: string;
        executable: string;
        args: string[];
        cwd: string;
        timeoutMs: number;
        allowedEnvironmentKeys: string[];
        networkRequired: boolean;
    }, {
        id: string;
        purpose: string;
        executable: string;
        args: string[];
        cwd: string;
        timeoutMs: number;
        allowedEnvironmentKeys: string[];
        networkRequired: boolean;
    }>, "many">;
    networkRequirements: z.ZodArray<z.ZodString, "many">;
    risk: z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>;
    riskReasons: z.ZodArray<z.ZodString, "many">;
    evidence: z.ZodAny;
    createdAt: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["PROPOSED", "APPROVED", "APPLYING", "APPLIED", "VALIDATING", "COMPLETED", "VALIDATION_FAILED", "STALE", "REJECTED", "FAILED", "ROLLED_BACK"]>>;
    instrumentationPurpose: z.ZodDefault<z.ZodEnum<["BOOTSTRAP", "FLOW"]>>;
    flowId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowInitializationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowManifest: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<"1.0">;
        graphVersionId: z.ZodString;
        graphHash: z.ZodString;
        repositorySnapshotId: z.ZodString;
        initialStateId: z.ZodString;
        terminalStateIds: z.ZodArray<z.ZodString, "many">;
        paths: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
        unreachableStateIds: z.ZodArray<z.ZodString, "many">;
        checkpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["STATE", "TRANSITION"]>;
            stateId: z.ZodNullable<z.ZodString>;
            transitionId: z.ZodNullable<z.ZodString>;
            stateRole: z.ZodNullable<z.ZodEnum<["INITIAL", "NORMAL", "TERMINAL"]>>;
            terminalKind: z.ZodNullable<z.ZodString>;
            eventType: z.ZodString;
            expectedState: z.ZodNullable<z.ZodString>;
            fromCheckpointId: z.ZodNullable<z.ZodString>;
            toCheckpointId: z.ZodNullable<z.ZodString>;
            required: z.ZodBoolean;
            mapping: z.ZodObject<{
                file: z.ZodNullable<z.ZodString>;
                symbol: z.ZodNullable<z.ZodString>;
                confidence: z.ZodNumber;
                rationale: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }, {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            }>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }, {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }>, "many">;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }, {
        version: "1.0";
        generatedAt: string;
        graphVersionId: string;
        graphHash: string;
        repositorySnapshotId: string;
        initialStateId: string;
        terminalStateIds: string[];
        paths: string[][];
        unreachableStateIds: string[];
        checkpoints: {
            id: string;
            terminalKind: string | null;
            kind: "STATE" | "TRANSITION";
            stateId: string | null;
            transitionId: string | null;
            stateRole: "NORMAL" | "INITIAL" | "TERMINAL" | null;
            eventType: string;
            expectedState: string | null;
            fromCheckpointId: string | null;
            toCheckpointId: string | null;
            required: boolean;
            mapping: {
                symbol: string | null;
                confidence: number;
                rationale: string;
                file: string | null;
            };
        }[];
    }>>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const InstrumentationDetectionSchema: z.ZodObject<{
    adapterId: z.ZodEnum<["react-vite", "nextjs", "express", "fastify", "nestjs"]>;
    adapterVersion: z.ZodString;
    supported: z.ZodBoolean;
    confidence: z.ZodNumber;
    frameworkVersion: z.ZodNullable<z.ZodString>;
    supportedVersionRange: z.ZodString;
    evidence: z.ZodArray<z.ZodString, "many">;
    reasons: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    evidence: string[];
    adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
    adapterVersion: string;
    frameworkVersion: string | null;
    supportedVersionRange: string;
    supported: boolean;
    reasons: string[];
}, {
    confidence: number;
    evidence: string[];
    adapterId: "react-vite" | "nextjs" | "express" | "fastify" | "nestjs";
    adapterVersion: string;
    frameworkVersion: string | null;
    supportedVersionRange: string;
    supported: boolean;
    reasons: string[];
}>;
export declare const InstrumentationApprovalSchema: z.ZodObject<{
    applicationId: z.ZodString;
    planId: z.ZodString;
    environmentId: z.ZodString;
    approvedFileScopes: z.ZodArray<z.ZodString, "many">;
    approvedCommandIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    applicationId: string;
    environmentId: string;
    planId: string;
    approvedFileScopes: string[];
    approvedCommandIds: string[];
}, {
    applicationId: string;
    environmentId: string;
    planId: string;
    approvedFileScopes: string[];
    approvedCommandIds: string[];
}>;
export declare const InstrumentationApplyResultSchema: z.ZodObject<{
    planId: z.ZodString;
    checkpointId: z.ZodString;
    checkpointDirectory: z.ZodString;
    baseRevision: z.ZodNullable<z.ZodString>;
    files: z.ZodArray<z.ZodObject<{
        relativePath: z.ZodString;
        beforeHash: z.ZodNullable<z.ZodString>;
        afterHash: z.ZodString;
        changed: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        relativePath: string;
        beforeHash: string | null;
        afterHash: string;
        changed: boolean;
    }, {
        relativePath: string;
        beforeHash: string | null;
        afterHash: string;
        changed: boolean;
    }>, "many">;
    changedFiles: z.ZodArray<z.ZodString, "many">;
    diff: z.ZodString;
    diffHash: z.ZodString;
    appliedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    planId: string;
    appliedAt: string;
    checkpointId: string;
    baseRevision: string | null;
    checkpointDirectory: string;
    files: {
        relativePath: string;
        beforeHash: string | null;
        afterHash: string;
        changed: boolean;
    }[];
    changedFiles: string[];
    diff: string;
    diffHash: string;
}, {
    planId: string;
    appliedAt: string;
    checkpointId: string;
    baseRevision: string | null;
    checkpointDirectory: string;
    files: {
        relativePath: string;
        beforeHash: string | null;
        afterHash: string;
        changed: boolean;
    }[];
    changedFiles: string[];
    diff: string;
    diffHash: string;
}>;
export declare const InstrumentationValidationResultSchema: z.ZodObject<{
    valid: z.ZodBoolean;
    checks: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        passed: z.ZodBoolean;
        output: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        passed: boolean;
        output: string;
    }, {
        name: string;
        passed: boolean;
        output: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    valid: boolean;
    checks: {
        name: string;
        passed: boolean;
        output: string;
    }[];
}, {
    valid: boolean;
    checks: {
        name: string;
        passed: boolean;
        output: string;
    }[];
}>;
export declare const StartGuidedRunInputSchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    traceId: z.ZodOptional<z.ZodString>;
    applicationId: z.ZodString;
    environmentId: z.ZodString;
    workspaceId: z.ZodNullable<z.ZodString>;
    flowId: z.ZodString;
    flowBindingId: z.ZodString;
    flowInitializationId: z.ZodString;
    flowScanId: z.ZodString;
    flowDriftId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expectedGraphVersionId: z.ZodString;
    captureTracks: z.ZodDefault<z.ZodArray<z.ZodEnum<["FRONTEND", "BACKEND"]>, "many">>;
    timeoutSeconds: z.ZodOptional<z.ZodNumber>;
    patchSetId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    environmentType: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
    mode: z.ZodDefault<z.ZodEnum<["GUIDED", "OBSERVATION_ONLY"]>>;
    targetUrl: z.ZodString;
    productionObservationApproved: z.ZodOptional<z.ZodBoolean>;
    launchCommandId: z.ZodOptional<z.ZodString>;
    launchApproved: z.ZodOptional<z.ZodBoolean>;
    relayEndpoint: z.ZodOptional<z.ZodString>;
    relayToken: z.ZodOptional<z.ZodString>;
    agentVersion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string | null;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string;
    flowId: string;
    flowBindingId: string;
    flowInitializationId: string;
    flowScanId: string;
    captureTracks: ("FRONTEND" | "BACKEND")[];
    mode: "GUIDED" | "OBSERVATION_ONLY";
    targetUrl: string;
    environmentType: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
    runId?: string | undefined;
    sessionId?: string | undefined;
    traceId?: string | undefined;
    agentVersion?: string | undefined;
    flowDriftId?: string | null | undefined;
    patchSetId?: string | null | undefined;
    timeoutSeconds?: number | undefined;
    productionObservationApproved?: boolean | undefined;
    launchCommandId?: string | undefined;
    launchApproved?: boolean | undefined;
    relayEndpoint?: string | undefined;
    relayToken?: string | undefined;
}, {
    workspaceId: string | null;
    applicationId: string;
    environmentId: string;
    expectedGraphVersionId: string;
    flowId: string;
    flowBindingId: string;
    flowInitializationId: string;
    flowScanId: string;
    targetUrl: string;
    environmentType: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
    runId?: string | undefined;
    sessionId?: string | undefined;
    traceId?: string | undefined;
    agentVersion?: string | undefined;
    flowDriftId?: string | null | undefined;
    captureTracks?: ("FRONTEND" | "BACKEND")[] | undefined;
    mode?: "GUIDED" | "OBSERVATION_ONLY" | undefined;
    patchSetId?: string | null | undefined;
    timeoutSeconds?: number | undefined;
    productionObservationApproved?: boolean | undefined;
    launchCommandId?: string | undefined;
    launchApproved?: boolean | undefined;
    relayEndpoint?: string | undefined;
    relayToken?: string | undefined;
}>;
export declare const IPC: {
    readonly getVersion: "tellann:version";
    readonly copyText: "tellann:system:copy-text";
    readonly getSession: "tellann:auth:session";
    readonly claimSetupHandoff: "tellann:setup:handoff:claim";
    readonly consumeSetupHandoff: "tellann:setup:handoff:consume";
    readonly getSdkSetup: "tellann:setup:sdk:get";
    readonly issueSdkSetupKey: "tellann:setup:sdk:key";
    readonly signIn: "tellann:auth:sign-in";
    readonly reopenSignIn: "tellann:auth:reopen-sign-in";
    readonly cancelSignIn: "tellann:auth:cancel-sign-in";
    readonly signOut: "tellann:auth:sign-out";
    readonly getApplications: "tellann:cloud:applications";
    readonly appUpdated: "tellann:cloud:app-updated";
    readonly listRuns: "tellann:cloud:runs:list";
    readonly getRun: "tellann:cloud:runs:get";
    readonly getRunReplay: "tellann:cloud:runs:replay";
    readonly getRunReport: "tellann:cloud:runs:report";
    readonly getDeclaredFlows: "tellann:cloud:intent:list";
    readonly getDeclaredFlow: "tellann:cloud:intent:get";
    readonly createDeclaredFlow: "tellann:cloud:intent:create";
    readonly addDeclaredState: "tellann:cloud:intent:state:add";
    readonly updateDeclaredState: "tellann:cloud:intent:state:update";
    readonly deleteDeclaredState: "tellann:cloud:intent:state:delete";
    readonly addDeclaredTransition: "tellann:cloud:intent:transition:add";
    readonly completeDeclaredFlow: "tellann:cloud:intent:complete";
    readonly reopenDeclaredFlow: "tellann:cloud:intent:reopen";
    readonly generateFlowSuggestions: "tellann:cloud:intent:suggestions:generate";
    readonly getFlowSuggestions: "tellann:cloud:intent:suggestions:list";
    readonly acceptFlowSuggestion: "tellann:cloud:intent:suggestions:accept";
    readonly rejectFlowSuggestion: "tellann:cloud:intent:suggestions:reject";
    readonly previewFlowReview: "tellann:cloud:intent:review:preview";
    readonly applyFlowReview: "tellann:cloud:intent:review:apply";
    readonly declineFlowReview: "tellann:cloud:intent:review:decline";
    readonly getFlowDiagrams: "tellann:cloud:flow:diagrams";
    readonly initializeFlow: "tellann:flow:initialize";
    readonly getFlowInitialization: "tellann:flow:initialization:get";
    readonly analyzeFlowInitialization: "tellann:flow:initialization:analyze";
    readonly setFlowInitializationMode: "tellann:flow:initialization:mode";
    readonly updateFlowRoadmapStep: "tellann:flow:initialization:roadmap:step";
    readonly startFlowVerification: "tellann:flow:initialization:verification:start";
    readonly getFlowVerification: "tellann:flow:initialization:verification:get";
    readonly rescanFlow: "tellann:flow:rescan";
    readonly approveFlowInitialization: "tellann:flow:initialization:approve";
    readonly applyFlowInitialization: "tellann:flow:initialization:apply";
    readonly validateFlowInitialization: "tellann:flow:initialization:validate";
    readonly importDocuments: "tellann:documents:import";
    readonly listDocuments: "tellann:documents:list";
    readonly getDocumentJob: "tellann:documents:job:get";
    readonly createIntentDraft: "tellann:intent:draft:create";
    readonly listIntentDraftJobs: "tellann:intent:draft:jobs:list";
    readonly getIntentDraftJob: "tellann:intent:draft:job:get";
    readonly cancelIntentDraftJob: "tellann:intent:draft:job:cancel";
    readonly listIntentDrafts: "tellann:intent:draft:list";
    readonly getIntentDraft: "tellann:intent:draft:get";
    readonly reviewIntentDraft: "tellann:intent:draft:review";
    readonly deleteIntentDraft: "tellann:intent:draft:delete";
    readonly correctIntentDraft: "tellann:intent:draft:correct";
    readonly openExternal: "tellann:system:open-external";
    readonly openPath: "tellann:system:open-path";
    readonly openProfile: "tellann:system:open-profile";
    readonly chooseWorkspace: "tellann:workspace:choose";
    readonly getLocalWorkspace: "tellann:workspace:local-state";
    readonly scanWorkspace: "tellann:workspace:scan";
    readonly cloneWorkspace: "tellann:workspace:clone";
    readonly startGuidedRun: "tellann:run:start";
    readonly pauseGuidedRun: "tellann:run:pause";
    readonly endGuidedRun: "tellann:run:end";
    readonly getRunState: "tellann:run:state";
    readonly detectInstrumentation: "tellann:instrumentation:detect";
    readonly proposeInstrumentation: "tellann:instrumentation:propose";
    readonly listInstrumentationPlans: "tellann:instrumentation:plans:list";
    readonly getInstrumentationPlan: "tellann:instrumentation:plans:get";
    readonly approveInstrumentation: "tellann:instrumentation:approve";
    readonly rejectInstrumentation: "tellann:instrumentation:reject";
    readonly applyInstrumentation: "tellann:instrumentation:apply";
    readonly validateInstrumentation: "tellann:instrumentation:validate";
    readonly rollbackInstrumentation: "tellann:instrumentation:rollback";
    readonly getLocalInstrumentationResult: "tellann:instrumentation:local-result";
    readonly generateInstrumentationReport: "tellann:instrumentation:report:generate";
};
export declare const DesktopSessionSchema: z.ZodObject<{
    authenticated: z.ZodBoolean;
    deviceSessionId: z.ZodNullable<z.ZodString>;
    user: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        displayName: string | null;
    }, {
        id: string;
        email: string;
        displayName: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    deviceSessionId: string | null;
    authenticated: boolean;
    user: {
        id: string;
        email: string;
        displayName: string | null;
    } | null;
}, {
    deviceSessionId: string | null;
    authenticated: boolean;
    user: {
        id: string;
        email: string;
        displayName: string | null;
    } | null;
}>;
export declare const DesktopEntitlementsSchema: z.ZodObject<{
    planType: z.ZodEnum<["FREE", "LOCAL", "SOLO", "TEAM", "BUSINESS", "ENTERPRISE"]>;
    features: z.ZodObject<{
        DESKTOP_GUIDED_RUNS: z.ZodBoolean;
        DOCUMENT_FLOW_INFERENCE: z.ZodBoolean;
        AUTOMATED_INSTRUMENTATION: z.ZodBoolean;
        SHARED_RUN_GOVERNANCE: z.ZodBoolean;
        BROWSER_TRACE_CAPTURE: z.ZodBoolean;
        VISUAL_ACCESSIBILITY_ANALYSIS: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        DESKTOP_GUIDED_RUNS: boolean;
        DOCUMENT_FLOW_INFERENCE: boolean;
        AUTOMATED_INSTRUMENTATION: boolean;
        SHARED_RUN_GOVERNANCE: boolean;
        BROWSER_TRACE_CAPTURE: boolean;
        VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
    }, {
        DESKTOP_GUIDED_RUNS: boolean;
        DOCUMENT_FLOW_INFERENCE: boolean;
        AUTOMATED_INSTRUMENTATION: boolean;
        SHARED_RUN_GOVERNANCE: boolean;
        BROWSER_TRACE_CAPTURE: boolean;
        VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    planType: "FREE" | "LOCAL" | "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE";
    features: {
        DESKTOP_GUIDED_RUNS: boolean;
        DOCUMENT_FLOW_INFERENCE: boolean;
        AUTOMATED_INSTRUMENTATION: boolean;
        SHARED_RUN_GOVERNANCE: boolean;
        BROWSER_TRACE_CAPTURE: boolean;
        VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
    };
}, {
    planType: "FREE" | "LOCAL" | "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE";
    features: {
        DESKTOP_GUIDED_RUNS: boolean;
        DOCUMENT_FLOW_INFERENCE: boolean;
        AUTOMATED_INSTRUMENTATION: boolean;
        SHARED_RUN_GOVERNANCE: boolean;
        BROWSER_TRACE_CAPTURE: boolean;
        VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
    };
}>;
export declare const DesktopApplicationSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    summary: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    organizationId: z.ZodString;
    organizationName: z.ZodString;
    entitlements: z.ZodNullable<z.ZodObject<{
        planType: z.ZodEnum<["FREE", "LOCAL", "SOLO", "TEAM", "BUSINESS", "ENTERPRISE"]>;
        features: z.ZodObject<{
            DESKTOP_GUIDED_RUNS: z.ZodBoolean;
            DOCUMENT_FLOW_INFERENCE: z.ZodBoolean;
            AUTOMATED_INSTRUMENTATION: z.ZodBoolean;
            SHARED_RUN_GOVERNANCE: z.ZodBoolean;
            BROWSER_TRACE_CAPTURE: z.ZodBoolean;
            VISUAL_ACCESSIBILITY_ANALYSIS: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            DESKTOP_GUIDED_RUNS: boolean;
            DOCUMENT_FLOW_INFERENCE: boolean;
            AUTOMATED_INSTRUMENTATION: boolean;
            SHARED_RUN_GOVERNANCE: boolean;
            BROWSER_TRACE_CAPTURE: boolean;
            VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
        }, {
            DESKTOP_GUIDED_RUNS: boolean;
            DOCUMENT_FLOW_INFERENCE: boolean;
            AUTOMATED_INSTRUMENTATION: boolean;
            SHARED_RUN_GOVERNANCE: boolean;
            BROWSER_TRACE_CAPTURE: boolean;
            VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        planType: "FREE" | "LOCAL" | "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE";
        features: {
            DESKTOP_GUIDED_RUNS: boolean;
            DOCUMENT_FLOW_INFERENCE: boolean;
            AUTOMATED_INSTRUMENTATION: boolean;
            SHARED_RUN_GOVERNANCE: boolean;
            BROWSER_TRACE_CAPTURE: boolean;
            VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
        };
    }, {
        planType: "FREE" | "LOCAL" | "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE";
        features: {
            DESKTOP_GUIDED_RUNS: boolean;
            DOCUMENT_FLOW_INFERENCE: boolean;
            AUTOMATED_INSTRUMENTATION: boolean;
            SHARED_RUN_GOVERNANCE: boolean;
            BROWSER_TRACE_CAPTURE: boolean;
            VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
        };
    }>>;
    environments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["DEVELOPMENT", "STAGING", "PRODUCTION"]>;
        baseUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
        baseUrl?: string | null | undefined;
    }, {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
        baseUrl?: string | null | undefined;
    }>, "many">;
    projectWorkspaces: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        opaqueLocalId: z.ZodString;
        repositoryFingerprint: z.ZodString;
        repositoryOriginHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        repositoryCloneUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        packageManager: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        detectedStack: z.ZodOptional<z.ZodAny>;
        snapshots: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        repositoryFingerprint: string;
        opaqueLocalId: string;
        repositoryOriginHash?: string | null | undefined;
        repositoryCloneUrl?: string | null | undefined;
        packageManager?: string | null | undefined;
        detectedStack?: any;
        snapshots?: any[] | undefined;
    }, {
        id: string;
        repositoryFingerprint: string;
        opaqueLocalId: string;
        repositoryOriginHash?: string | null | undefined;
        repositoryCloneUrl?: string | null | undefined;
        packageManager?: string | null | undefined;
        detectedStack?: any;
        snapshots?: any[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    organizationId: string;
    organizationName: string;
    entitlements: {
        planType: "FREE" | "LOCAL" | "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE";
        features: {
            DESKTOP_GUIDED_RUNS: boolean;
            DOCUMENT_FLOW_INFERENCE: boolean;
            AUTOMATED_INSTRUMENTATION: boolean;
            SHARED_RUN_GOVERNANCE: boolean;
            BROWSER_TRACE_CAPTURE: boolean;
            VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
        };
    } | null;
    environments: {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
        baseUrl?: string | null | undefined;
    }[];
    summary?: string | null | undefined;
    projectWorkspaces?: {
        id: string;
        repositoryFingerprint: string;
        opaqueLocalId: string;
        repositoryOriginHash?: string | null | undefined;
        repositoryCloneUrl?: string | null | undefined;
        packageManager?: string | null | undefined;
        detectedStack?: any;
        snapshots?: any[] | undefined;
    }[] | undefined;
}, {
    id: string;
    name: string;
    organizationId: string;
    organizationName: string;
    entitlements: {
        planType: "FREE" | "LOCAL" | "SOLO" | "TEAM" | "BUSINESS" | "ENTERPRISE";
        features: {
            DESKTOP_GUIDED_RUNS: boolean;
            DOCUMENT_FLOW_INFERENCE: boolean;
            AUTOMATED_INSTRUMENTATION: boolean;
            SHARED_RUN_GOVERNANCE: boolean;
            BROWSER_TRACE_CAPTURE: boolean;
            VISUAL_ACCESSIBILITY_ANALYSIS: boolean;
        };
    } | null;
    environments: {
        id: string;
        type: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
        name: string;
        baseUrl?: string | null | undefined;
    }[];
    summary?: string | null | undefined;
    projectWorkspaces?: {
        id: string;
        repositoryFingerprint: string;
        opaqueLocalId: string;
        repositoryOriginHash?: string | null | undefined;
        repositoryCloneUrl?: string | null | undefined;
        packageManager?: string | null | undefined;
        detectedStack?: any;
        snapshots?: any[] | undefined;
    }[] | undefined;
}>;
export type DesktopDevice = z.infer<typeof DesktopDeviceSchema>;
export type DesktopPermission = z.infer<typeof DesktopPermissionSchema>;
export type RepositorySnapshotSummary = z.infer<typeof RepositorySnapshotSummarySchema>;
export type RunCorrelationContext = z.infer<typeof RunCorrelationContextSchema>;
export type QARun = z.infer<typeof QARunSchema>;
export type QARunSummary = z.infer<typeof QARunSummarySchema>;
export type QualityReport = z.infer<typeof QualityReportSchema>;
export type DeclaredFlowSummary = z.infer<typeof DeclaredFlowSummarySchema>;
export type DeclaredState = z.infer<typeof DeclaredStateSchema>;
export type DeclaredTransition = z.infer<typeof DeclaredTransitionSchema>;
export type DeclaredFlowDetail = z.infer<typeof DeclaredFlowDetailSchema>;
export type DeclaredStateSuggestion = z.infer<typeof DeclaredStateSuggestionSchema>;
export type FlowSuggestionMeta = z.infer<typeof FlowSuggestionMetaSchema>;
export type FlowSuggestionsResponse = z.infer<typeof FlowSuggestionsResponseSchema>;
export type FlowReviewPreview = z.infer<typeof FlowReviewPreviewSchema>;
export type FlowDiagram = z.infer<typeof FlowDiagramSchema>;
export type FlowProjectBinding = z.infer<typeof FlowProjectBindingSchema>;
export type FlowInitialization = z.infer<typeof FlowInitializationSchema>;
export type FlowCheckpoint = z.infer<typeof FlowCheckpointSchema>;
export type FlowInitializationManifest = z.infer<typeof FlowInitializationManifestSchema>;
export type FlowCodeReviewReport = z.infer<typeof FlowCodeReviewReportSchema>;
export type ManualRoadmap = z.infer<typeof ManualRoadmapSchema>;
export type ManualRoadmapStep = z.infer<typeof ManualRoadmapStepSchema>;
export type CheckpointCoverage = z.infer<typeof CheckpointCoverageSchema>;
export type SourceDocumentManifest = z.infer<typeof SourceDocumentManifestSchema>;
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummarySchema>;
export type DocumentAccess = z.infer<typeof DocumentAccessSchema>;
export type DocumentImportResult = z.infer<typeof DocumentImportResultSchema>;
export type DocumentProcessingJob = z.infer<typeof DocumentProcessingJobSchema>;
export type IntentDraftJob = z.infer<typeof IntentDraftJobSchema>;
export type IntentDraftJobCreated = z.infer<typeof IntentDraftJobCreatedSchema>;
export type IntentDraft = z.infer<typeof IntentDraftSchema>;
export type InstrumentationDetection = z.infer<typeof InstrumentationDetectionSchema>;
export type SdkSetupDescriptor = z.infer<typeof SdkSetupDescriptorSchema>;
export type SdkReadiness = z.infer<typeof SdkReadinessSchema>;
export type SdkSetupTarget = z.infer<typeof SdkSetupTargetSchema>;
export type DesktopSetupHandoff = z.infer<typeof DesktopSetupHandoffSchema>;
export type InstrumentationPlan = z.infer<typeof InstrumentationPlanSchema>;
export type InstrumentationApplyResult = z.infer<typeof InstrumentationApplyResultSchema>;
export type InstrumentationValidationResult = z.infer<typeof InstrumentationValidationResultSchema>;
export type QARunArtifact = z.infer<typeof QARunArtifactSchema>;
export type BrowserFinding = z.infer<typeof BrowserFindingSchema>;
export type StartGuidedRunInput = z.infer<typeof StartGuidedRunInputSchema>;
export type DesktopSession = z.infer<typeof DesktopSessionSchema>;
export type DesktopEntitlements = z.infer<typeof DesktopEntitlementsSchema>;
export type DesktopApplication = z.infer<typeof DesktopApplicationSchema>;
