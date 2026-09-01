import { BrowserWindow } from "electron";

type ReportCheck = { name: string; passed: boolean; output: string };
type ReportCommand = {
  id: string;
  purpose?: string;
  passed: boolean;
  exitCode?: number | null;
  durationMs?: number;
  output: string;
};
type ReportFile = {
  relativePath: string;
  beforeHash: string | null;
  afterHash: string;
  changed: boolean;
};
type ReportOperation = {
  id: string;
  kind: string;
  relativePath: string;
  description: string;
};

export type ValidationReportInput = {
  applicationName: string;
  environmentName: string;
  planId: string;
  adapterId: string;
  adapterVersion: string;
  status: string;
  generatedAt: string;
  baseRevision: string | null;
  repositoryFingerprint: string;
  risk: string;
  riskReasons: string[];
  packageChanges: Array<{ packageName: string; version: string; kind: string }>;
  operations: ReportOperation[];
  files: ReportFile[];
  patch: { checkpointId: string; diffHash: string; appliedAt: string };
  checkpoint: {
    kind: string;
    branch: string | null;
    previousBranch: string | null;
    baseRevision: string | null;
    dirty: boolean;
    reason: string | null;
    createdAt: string;
  } | null;
  checks: ReportCheck[];
  commands: ReportCommand[];
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

function diagnosticSummary(
  output: string,
): Array<{ label: string; count: number }> {
  const categories = [
    ["Missing or incompatible properties", /TS23(?:39|35|45|22|27|69)/g],
    ["Unused code", /TS6(?:133|196|196|190)/g],
    ["Type and nullability problems", /TS(?:2322|18048|2532|7006|2769)/g],
    ["Missing exports or modules", /TS2305/g],
    ["Invalid comparisons or enums", /TS2367/g],
  ] as const;
  return categories
    .map(([label, pattern]) => ({
      label,
      count: output.match(pattern)?.length ?? 0,
    }))
    .filter((item) => item.count > 0);
}

const TELLANN_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1500 1499.999933" preserveAspectRatio="xMidYMid meet" version="1.0"><defs><clipPath id="1f4cf3e11c"><path d="M 631.167969 15.863281 L 899.433594 15.863281 L 899.433594 284.128906 L 631.167969 284.128906 Z M 631.167969 15.863281 " clip-rule="nonzero"/></clipPath><clipPath id="bf2d5c83b2"><path d="M 765.300781 15.863281 C 691.222656 15.863281 631.167969 75.914062 631.167969 149.996094 C 631.167969 224.074219 691.222656 284.128906 765.300781 284.128906 C 839.378906 284.128906 899.433594 224.074219 899.433594 149.996094 C 899.433594 75.914062 839.378906 15.863281 765.300781 15.863281 Z M 765.300781 15.863281 " clip-rule="nonzero"/></clipPath><clipPath id="9e30622e1e"><path d="M 1173.792969 361.261719 L 1442.058594 361.261719 L 1442.058594 629.527344 L 1173.792969 629.527344 Z M 1173.792969 361.261719 " clip-rule="nonzero"/></clipPath><clipPath id="741f6fd36b"><path d="M 1307.925781 361.261719 C 1233.847656 361.261719 1173.792969 421.316406 1173.792969 495.394531 C 1173.792969 569.472656 1233.847656 629.527344 1307.925781 629.527344 C 1382.003906 629.527344 1442.058594 569.472656 1442.058594 495.394531 C 1442.058594 421.316406 1382.003906 361.261719 1307.925781 361.261719 Z M 1307.925781 361.261719 " clip-rule="nonzero"/></clipPath><clipPath id="2264d827fc"><path d="M 1173.792969 871.246094 L 1442.058594 871.246094 L 1442.058594 1139.511719 L 1173.792969 1139.511719 Z M 1173.792969 871.246094 " clip-rule="nonzero"/></clipPath><clipPath id="6933adc23d"><path d="M 1307.925781 871.246094 C 1233.847656 871.246094 1173.792969 931.300781 1173.792969 1005.378906 C 1173.792969 1079.457031 1233.847656 1139.511719 1307.925781 1139.511719 C 1382.003906 1139.511719 1442.058594 1079.457031 1442.058594 1005.378906 C 1442.058594 931.300781 1382.003906 871.246094 1307.925781 871.246094 Z M 1307.925781 871.246094 " clip-rule="nonzero"/></clipPath><clipPath id="64767d7fd4"><path d="M 631.167969 1231.722656 L 899.433594 1231.722656 L 899.433594 1499.988281 L 631.167969 1499.988281 Z M 631.167969 1231.722656 " clip-rule="nonzero"/></clipPath><clipPath id="d9ea6a4170"><path d="M 765.300781 1231.722656 C 691.222656 1231.722656 631.167969 1291.777344 631.167969 1365.855469 C 631.167969 1439.933594 691.222656 1499.988281 765.300781 1499.988281 C 839.378906 1499.988281 899.433594 1439.933594 899.433594 1365.855469 C 899.433594 1291.777344 839.378906 1231.722656 765.300781 1231.722656 Z M 765.300781 1231.722656 " clip-rule="nonzero"/></clipPath></defs><g clip-path="url(#1f4cf3e11c)"><g clip-path="url(#bf2d5c83b2)"><path stroke-linecap="butt" transform="matrix(0.75, 0, 0, 0.75, 631.168467, 15.861677)" fill="none" stroke-linejoin="miter" d="M 178.843101 0.0021396 C 80.072259 0.0021396 -0.000664314 80.069855 -0.000664314 178.845905 C -0.000664314 277.616747 80.072259 357.68967 178.843101 357.68967 C 277.613943 357.68967 357.686866 277.616747 357.686866 178.845905 C 357.686866 80.069855 277.613943 0.0021396 178.843101 0.0021396 Z M 178.843101 0.0021396 " stroke="#000000" stroke-width="154" stroke-opacity="1" stroke-miterlimit="4"/></g></g><g clip-path="url(#9e30622e1e)"><g clip-path="url(#741f6fd36b)"><path stroke-linecap="butt" transform="matrix(0.75, 0, 0, 0.75, 1173.79282, 361.261766)" fill="none" stroke-linejoin="miter" d="M 178.843963 -0.0000625778 C 80.073122 -0.0000625778 0.000198004 80.072861 0.000198004 178.843703 C 0.000198004 277.614545 80.073122 357.687468 178.843963 357.687468 C 277.614805 357.687468 357.687729 277.614545 357.687729 178.843703 C 357.687729 80.072861 277.614805 -0.0000625778 178.843963 -0.0000625778 Z M 178.843963 -0.0000625778 " stroke="#000000" stroke-width="154" stroke-opacity="1" stroke-miterlimit="4"/></g></g><g clip-path="url(#2264d827fc)"><g clip-path="url(#6933adc23d)"><path stroke-linecap="butt" transform="matrix(0.75, 0, 0, 0.75, 1173.79282, 871.246201)" fill="none" stroke-linejoin="miter" d="M 178.843963 -0.000142942 C 80.073122 -0.000142942 0.000198004 80.072781 0.000198004 178.843622 C 0.000198004 277.614464 80.073122 357.687388 178.843963 357.687388 C 277.614805 357.687388 357.687729 277.614464 357.687729 178.843622 C 357.687729 80.072781 277.614805 -0.000142942 178.843963 -0.000142942 Z M 178.843963 -0.000142942 " stroke="#000000" stroke-width="154" stroke-opacity="1" stroke-miterlimit="4"/></g></g><g clip-path="url(#64767d7fd4)"><g clip-path="url(#d9ea6a4170)"><path stroke-linecap="butt" transform="matrix(0.75, 0, 0, 0.75, 631.168467, 1231.723242)" fill="none" stroke-linejoin="miter" d="M 178.843101 -0.000780877 C 80.072259 -0.000780877 -0.000664314 80.072143 -0.000664314 178.842985 C -0.000664314 277.613826 80.072259 357.68675 178.843101 357.68675 C 277.613943 357.68675 357.686866 277.613826 357.686866 178.842985 C 357.686866 80.072143 277.613943 -0.000780877 178.843101 -0.000780877 Z M 178.843101 -0.000780877 " stroke="#000000" stroke-width="154" stroke-opacity="1" stroke-miterlimit="4"/></g></g><path stroke-linecap="butt" transform="matrix(0.637264, 0.395468, -0.395468, 0.637264, 888.037397, 157.964131)" fill="none" stroke-linejoin="miter" d="M -0.00086488 50.498297 L 578.282326 50.496966 " stroke="#000000" stroke-width="101" stroke-opacity="1" stroke-miterlimit="4"/><path stroke-linecap="round" transform="matrix(0.639079, -0.392527, 0.392527, 0.639079, 828.45589, 1291.647637)" fill="none" stroke-linejoin="miter" d="M 50.499192 50.498165 L 419.277643 50.500801 " stroke="#000000" stroke-width="101" stroke-opacity="1" stroke-miterlimit="4"/><path stroke-linecap="butt" transform="matrix(-0.649519, 0.375, -0.375, -0.649519, 679.236767, 230.00331)" fill="none" stroke-linejoin="miter" d="M -0.0013978 50.498387 L 556.262485 50.50036 " stroke="#000000" stroke-width="101" stroke-opacity="1" stroke-miterlimit="4"/><path stroke-linecap="butt" transform="matrix(0, 0.75, -0.75, 0, 256.058889, 531.734886)" fill="none" stroke-linejoin="miter" d="M -0.0006816 50.500398 L 556.259783 50.500398 " stroke="#000000" stroke-width="101" stroke-opacity="1" stroke-miterlimit="4"/><path stroke-linecap="butt" transform="matrix(0.650342, 0.37357, -0.37357, 0.650342, 343.869085, 1080.898375)" fill="none" stroke-linejoin="miter" d="M 0.00115886 50.501684 L 556.26287 50.498435 " stroke="#000000" stroke-width="101" stroke-opacity="1" stroke-miterlimit="4"/><path stroke-linecap="butt" transform="matrix(-0.403782, 0.632029, -0.632029, -0.403782, 346.30304, 403.036265)" fill="none" stroke-linejoin="miter" d="M 23.952481 44.460348 C 110.294559 90.974655 184.885618 90.972591 247.716879 44.459764 " stroke="#000000" stroke-width="101" stroke-opacity="1" stroke-miterlimit="4"/><path stroke-linecap="butt" transform="matrix(0.404548, 0.631538, -0.631538, 0.404548, 234.997734, 909.523798)" fill="none" stroke-linejoin="miter" d="M 26.009718 43.285321 C 116.931298 97.921519 207.856617 97.919212 298.780057 43.287172 " stroke="#000000" stroke-width="101" stroke-opacity="1" stroke-miterlimit="4"/></svg>`;

export function validationReportHtml(input: ValidationReportInput): string {
  const failedCommands = input.commands.filter((command) => !command.passed);
  const diagnostics = failedCommands
    .map((command) => command.output)
    .join("\n");
  const summary = diagnosticSummary(diagnostics);
  const passedChecks = input.checks.filter((check) => check.passed).length;
  const failedChecks = input.checks.filter((check) => !check.passed);
  const changedFiles = input.files.filter((file) => file.changed);
  const title = `${input.applicationName} validation report`;
  const rows = [
    ["APPLICATION", input.applicationName],
    ["ENVIRONMENT", input.environmentName],
    ["ADAPTER", `${input.adapterId} ${input.adapterVersion}`],
    ["TASK ID", input.planId],
    ["GENERATED", new Date(input.generatedAt).toLocaleString()],
    ["STATUS", input.status],
  ]
    .map(
      ([label, value]) =>
        `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const checkRows = input.checks
    .map(
      (check) =>
        `<tr><td><span class="mark ${check.passed ? "pass" : "fail"}">${check.passed ? "PASS" : "FAIL"}</span></td><td><strong>${escapeHtml(check.name)}</strong><small>${escapeHtml(check.output)}</small></td></tr>`,
    )
    .join("");
  const categoryRows = summary.length
    ? summary
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.label)}</td><td>${item.count}</td></tr>`,
        )
        .join("")
    : "<tr><td>No TypeScript categories detected</td><td>0</td></tr>";
  const currentFileRows = input.files.length
    ? input.files
        .map(
          (file) =>
            `<tr><td>${escapeHtml(file.relativePath)}</td><td>${file.changed ? "CHANGED" : "UNCHANGED"}</td><td class="hash">${escapeHtml(file.afterHash)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="3">No current file manifest was available.</td></tr>';
  const previousFileRows = input.files.length
    ? input.files
        .map(
          (file) =>
            `<tr><td>${escapeHtml(file.relativePath)}</td><td>${file.beforeHash ? "EXISTED" : "NEW FILE"}</td><td class="hash">${escapeHtml(file.beforeHash ?? "NOT PRESENT")}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="3">No before-state file manifest was available.</td></tr>';
  const operationRows = input.operations.length
    ? input.operations
        .map(
          (operation) =>
            `<tr><td>${escapeHtml(operation.kind)}</td><td><strong>${escapeHtml(operation.relativePath)}</strong><small>${escapeHtml(operation.description)}</small></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="2">No operation manifest was available.</td></tr>';
  const packageRows = input.packageChanges.length
    ? input.packageChanges
        .map(
          (change) =>
            `<tr><td>${escapeHtml(change.kind)}</td><td>${escapeHtml(change.packageName)} ${escapeHtml(change.version)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="2">No dependency change was requested.</td></tr>';
  const commandRows = input.commands.length
    ? input.commands
        .map(
          (command) =>
            `<tr><td><span class="mark ${command.passed ? "pass" : "fail"}">${command.passed ? "PASS" : "FAIL"}</span></td><td><strong>${escapeHtml(command.purpose ?? command.id)}</strong><small>ID: ${escapeHtml(command.id)} | Exit: ${escapeHtml(command.exitCode ?? "unknown")} | Duration: ${escapeHtml(command.durationMs ?? 0)} ms</small></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="2">No approved command result was recorded.</td></tr>';
  const commandSections = failedCommands.length
    ? failedCommands
        .map(
          (command) =>
            `<section class="command"><div class="command-head"><strong>${escapeHtml(command.purpose ?? command.id)}</strong><span>EXIT ${escapeHtml(command.exitCode ?? "UNKNOWN")}</span></div><pre>${escapeHtml(command.output)}</pre></section>`,
        )
        .join("")
    : '<p class="muted">No failed command output was recorded.</p>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size:A4; margin:18mm 0; }
    *{box-sizing:border-box}
    html, body{margin:0;padding:0;background:#ffffff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:460px;height:460px;pointer-events:none;opacity:0.05;z-index:0;display:flex;align-items:center;justify-content:center}
    .watermark svg{width:100%;height:100%;display:block}
    main{background:transparent;position:relative;z-index:1}
    .sheet{border:none;background:transparent;padding:0 16mm;box-sizing:border-box}
    .brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px}
    .logo{font-size:20px;font-weight:800;letter-spacing:-.04em;color:#000}
    .badge,.mark{border:1px solid #cfcfcf;color:#666;padding:4px 7px;font:8pt 'Courier New',monospace;letter-spacing:.08em;text-transform:uppercase}
    .mark.pass{color:#111}
    .mark.fail{color:#111;border-color:#111;background:#ededed}
    h1{font-size:25px;line-height:1.2;margin:0 0 10px;color:#000}
    h2{font-size:17px;margin:28px 0 10px;color:#000}
    h3{font-size:12px;margin:20px 0 8px;color:#000}
    p{margin:0 0 12px}
    .muted,small{color:#666}
    table{width:100%;border-collapse:collapse;background:transparent}
    td{border:1px solid #dcdcdc;padding:8px 10px;vertical-align:top;background:transparent}
    td:first-child{color:#666;font:8pt 'Courier New',monospace;letter-spacing:.06em;width:28%}
    td:last-child{text-align:right;color:#000}
    .manifest td:nth-child(2),.checks td:last-child{text-align:left}
    .manifest small,.checks small{display:block;margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere}
    .hash{font:7pt 'Courier New',monospace;overflow-wrap:anywhere;max-width:260px}
    .summary{border:1px solid #dcdcdc;background:transparent;padding:18px;margin:18px 0}
    .metric{font:22px 'Courier New',monospace;color:#000}
    .command{break-inside:avoid;margin:0 0 14px}
    .command-head{display:flex;justify-content:space-between;border:1px solid #dcdcdc;padding:8px 10px;background:transparent}
    .command-head span{color:#666;font:8pt 'Courier New',monospace}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f6f6;border:1px solid #dcdcdc;border-top:0;margin:0;padding:12px;color:#333;font:7.5pt/1.45 'Courier New',monospace;max-height:none}
    ul,ol{margin:0;padding-left:19px}
    .footer{border-top:1px solid #dcdcdc;margin-top:30px;padding-top:14px;color:#666;font-size:8pt}
    .major{break-before:page}
    .notice{border-left:3px solid #000;background:transparent;padding:12px 14px;margin:12px 0}
    .section-label{font:8pt 'Courier New',monospace;color:#666;letter-spacing:.1em;text-transform:uppercase}
  </style></head><body><div class="watermark">${TELLANN_LOGO_SVG}</div><main><section class="sheet"><div class="brand"><div class="logo">TELLANN</div><span class="badge">QA // Validation blocker</span></div>
    <h1>${escapeHtml(title)}</h1><p class="muted">A developer-ready record of the automated instrumentation result, project build blocker, evidence, and recommended next actions.</p>
    <div class="summary"><div class="metric">${passedChecks}/${input.checks.length} checks passed</div><p>${failedCommands.length ? `${failedCommands.length} approved command failed; ${changedFiles.length} workspace files were changed by the approved task.` : `${changedFiles.length} workspace files were changed and no failed command was recorded.`}</p></div>
    <table>${rows}</table><h2>Executive assessment</h2><p>${failedCommands.length ? "Tellann applied the reviewed instrumentation scope and completed its structural SDK checks. The attached application then failed an approved project command. The evidence below separates the project before-state, Tellann changes, current state, and observed blocker." : "The recorded instrumentation and approved validation commands completed successfully."}</p>

    <section class="major"><div class="section-label">01 // Current state</div><h2>Current state of the project</h2><p>This section describes the evidence available after Tellann applied the reviewed task and ran validation. It does not infer the health of files or services that were outside the approved scope.</p>
      <table><tr><td>PLAN STATUS</td><td>${escapeHtml(input.status)}</td></tr><tr><td>VALIDATION</td><td>${failedChecks.length ? `${failedChecks.length} failed Tellann check(s)` : "Tellann structural checks passed"}</td></tr><tr><td>PROJECT BUILD</td><td>${failedCommands.length ? "Blocked by approved command failure" : "Approved commands passed"}</td></tr><tr><td>FILES CHANGED</td><td>${changedFiles.length}</td></tr><tr><td>PATCH APPLIED</td><td>${escapeHtml(new Date(input.patch.appliedAt).toLocaleString())}</td></tr><tr><td>DIFF HASH</td><td class="hash">${escapeHtml(input.patch.diffHash)}</td></tr><tr><td>CHECKPOINT ID</td><td>${escapeHtml(input.patch.checkpointId)}</td></tr></table>
      <h3>Current approved-file manifest</h3><table class="manifest"><tr><td>FILE</td><td>STATE</td><td>AFTER HASH</td></tr>${currentFileRows}</table>
      <h3>Current validation evidence</h3><table class="checks">${checkRows}</table>
    </section>

    <section class="major"><div class="section-label">02 // Previous state</div><h2>Previous state of the project</h2><p>This is the captured state immediately before Tellann wrote the approved instrumentation. File contents and raw diffs remain encrypted locally; the report uses hashes and checkpoint metadata to preserve privacy while supporting comparison and rollback.</p>
      <table><tr><td>BASE REVISION</td><td>${escapeHtml(input.baseRevision ?? "No Git revision recorded")}</td></tr><tr><td>REPOSITORY FINGERPRINT</td><td class="hash">${escapeHtml(input.repositoryFingerprint)}</td></tr><tr><td>CHECKPOINT TYPE</td><td>${escapeHtml(input.checkpoint?.kind ?? "Not recorded")}</td></tr><tr><td>PREVIOUS BRANCH</td><td>${escapeHtml(input.checkpoint?.previousBranch ?? "Not recorded")}</td></tr><tr><td>CHECKPOINT BRANCH</td><td>${escapeHtml(input.checkpoint?.branch ?? "Local encrypted checkpoint")}</td></tr><tr><td>WORKTREE DIRTY</td><td>${input.checkpoint?.dirty ? "YES - pre-existing changes were present" : "NO"}</td></tr><tr><td>CHECKPOINT CREATED</td><td>${escapeHtml(input.checkpoint?.createdAt ? new Date(input.checkpoint.createdAt).toLocaleString() : "Not recorded")}</td></tr><tr><td>CHECKPOINT NOTE</td><td>${escapeHtml(input.checkpoint?.reason ?? "No exception recorded")}</td></tr></table>
      <h3>Before-state approved-file manifest</h3><table class="manifest"><tr><td>FILE</td><td>PREVIOUS STATE</td><td>BEFORE HASH</td></tr>${previousFileRows}</table>
    </section>

    <section class="major"><div class="section-label">03 // Intended action</div><h2>What Tellann tried to do in the workspace</h2><p>Tellann attempted only the files and commands shown during the reviewed approval. It did not have permission to repair unrelated application code.</p>
      <div class="notice"><strong>Risk classification: ${escapeHtml(input.risk)}</strong><br>${escapeHtml(input.riskReasons.join(" | ") || "No additional risk reason was recorded.")}</div>
      <h3>Requested dependency changes</h3><table class="manifest">${packageRows}</table><h3>Approved code and configuration operations</h3><table class="manifest">${operationRows}</table><h3>Approved commands and recorded results</h3><table class="checks">${commandRows}</table>
    </section>

    <section class="major"><div class="section-label">04 // Observed outcome</div><h2>What ended up happening</h2><p>${failedCommands.length ? "The source integration, dependency resolution, generated configuration, file hashes, and idempotency checks were recorded. An approved project command then returned a non-zero exit code. The categorized and raw sanitized evidence follows." : "All recorded commands and Tellann checks passed."}</p>
      <h3>Diagnostic breakdown</h3><table>${categoryRows}</table><h3>Failed command diagnostics</h3>${commandSections}
      <div class="notice">No ingestion key, authentication token, raw environment value, absolute workspace path, or raw source diff is included in this report.</div>
    </section>

    <section class="major"><div class="section-label">05 // Resolution guidance</div><h2>Tips on how to resolve it</h2><ol><li>Start with the first compiler error in each affected module; later errors may be cascading consequences.</li><li>Align frontend models with the current API contracts, including missing properties, nullable fields, and enum values.</li><li>Restore missing service exports and state slices before addressing components that consume them.</li><li>Remove genuinely unused imports and variables, or change TypeScript policy only through the project review process.</li><li>Run the same approved build command directly in the package root until it exits successfully.</li><li>Do not remove Tellann generated markers or environment configuration while resolving unrelated project errors.</li></ol>
      <h3>Permission boundary</h3><p>Tellann will not automatically edit the unrelated files named in compiler diagnostics. Any assisted repair should be a new proposal listing exact files, intended edits, commands, checkpoint behavior, and rollback conditions for explicit approval.</p>
      <h2>Next steps after resolution</h2><ol><li>Commit or checkpoint the developer fixes according to the project workflow.</li><li>Return to this instrumentation task and select Re-run build and Tellann checks.</li><li>Confirm the project build passes and the SDK still resolves.</li><li>Start the approved application process and wait for the TELLANN_ONBOARDING_TEST event.</li><li>Confirm the target is verified in both Tellann Desktop and the web connection summary.</li><li>Run the first walkthrough and attach this report, plus the successful follow-up result, to the QA handoff.</li></ol>
    </section>
    <div class="footer">Tellann QA evidence report - generated locally by Tellann Desktop. Raw source changes remain on the attached device. This report was generated for engineering communication and project documentation.</div>
  </section></main></body></html>`;
}

export async function renderValidationReportPdf(
  input: ValidationReportInput,
): Promise<Buffer> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(validationReportHtml(input))}`,
    );
    return await window.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      // Vertical margins give the report breathing room on every page;
      // horizontal spacing is handled by the .sheet padding. Units are inches.
      margins: { top: 0.71, bottom: 0.71, left: 0, right: 0 },
    });
  } finally {
    window.destroy();
  }
}
