param(
  [string]$OutputDirectory = "tmp/email-previews",
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repositoryRoot

Write-Host "Building @sots/email..." -ForegroundColor Cyan
& pnpm.cmd --filter '@sots/email' build
if ($LASTEXITCODE -ne 0) {
  throw "The email package build failed with exit code $LASTEXITCODE."
}

$resolvedOutputDirectory = [System.IO.Path]::GetFullPath(
  (Join-Path $repositoryRoot $OutputDirectory)
)
$env:TELLANN_EMAIL_PREVIEW_OUTPUT = $resolvedOutputDirectory

Write-Host "Rendering email previews..." -ForegroundColor Cyan
@'
const fs = require('fs');
const path = require('path');
const {
  builtinTemplates,
  renderTemplateHtml,
} = require('./packages/email/dist');

const outputDirectory = process.env.TELLANN_EMAIL_PREVIEW_OUTPUT;
if (!outputDirectory) throw new Error('Preview output directory was not provided.');
fs.mkdirSync(outputDirectory, { recursive: true });

const sampleValues = {
  code: '842 195',
  expiresInMinutes: 10,
  userName: 'Alex Chen',
  organizationName: 'Tellann Global Ops',
  applicationName: 'Vector Service',
  environmentName: 'Production',
  role: 'ADMIN',
  invitedBy: 'Morgan Lee',
  keyPrefix: 'tl_live_9x28...',
  coverageScore: '62',
  previousCoverageScore: '78',
  missingFlowCount: 4,
  format: 'PDF',
  endpoint: 'POST /api/checkout',
  avgMs: 1840,
  percentUsed: 85,
  metric: 'Monthly sessions',
  planName: 'Team',
  amountPaid: 'USD 149.00',
  invoiceNumber: 'INV-2026-0721',
  ipAddress: '192.0.2.42',
  userAgent: 'Chrome on Windows',
  ruleName: 'Mask payment fields',
  sessionId: 'demo_01J8Y7K4F2',
};

function sampleValue(key) {
  if (Object.prototype.hasOwnProperty.call(sampleValues, key)) return sampleValues[key];
  if (/Url$/i.test(key)) return 'http://localhost:3000/example';
  if (/At$/i.test(key)) return '2026-07-21 14:32 UTC';
  return `Sample ${key}`;
}

const cards = [];
for (const template of builtinTemplates) {
  const variables = Object.fromEntries(
    template.requiredVariables.map((key) => [key, sampleValue(key)]),
  );

  // Include optional context used by the shared footer and richer layouts.
  variables.organizationName ??= sampleValues.organizationName;
  variables.applicationName ??= sampleValues.applicationName;
  variables.docsUrl ??= 'http://localhost:3002/quickstart';
  variables.dashboardUrl ??= 'http://localhost:3000/example';
  variables.appUrl ??= 'http://localhost:3000/auth/login';

  const filename = `${template.key}.html`;
  fs.writeFileSync(
    path.join(outputDirectory, filename),
    renderTemplateHtml(template, variables),
    'utf8',
  );
  cards.push(`<a href="${filename}" target="preview"><strong>${template.key}</strong><span>${template.category}</span></a>`);
}

const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tellann email previews</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #000; color: #e2e2e2; font-family: Arial, sans-serif; }
    header { padding: 18px 24px; border-bottom: 1px solid #262626; }
    header h1 { margin: 0 0 6px; font-size: 20px; }
    header p { margin: 0; color: #8e9192; font-size: 13px; }
    main { display: grid; grid-template-columns: 260px minmax(0, 1fr); height: calc(100vh - 78px); }
    nav { overflow: auto; padding: 12px; border-right: 1px solid #262626; }
    nav a { display: block; padding: 11px 12px; margin-bottom: 6px; border: 1px solid #262626; color: #fff; text-decoration: none; }
    nav a:hover { background: #1f1f1f; border-color: #757575; }
    nav strong, nav span { display: block; }
    nav strong { font-size: 13px; }
    nav span { margin-top: 4px; color: #8e9192; font: 10px monospace; }
    iframe { width: 100%; height: 100%; border: 0; background: #000; }
    @media (max-width: 720px) { main { grid-template-columns: 1fr; height: auto; } nav { max-height: 240px; border-right: 0; border-bottom: 1px solid #262626; } iframe { height: 760px; } }
  </style>
</head>
<body>
  <header><h1>Tellann email previews</h1><p>${builtinTemplates.length} templates rendered from the production email package</p></header>
  <main><nav>${cards.join('')}</nav><iframe name="preview" src="${builtinTemplates[0].key}.html" title="Email preview"></iframe></main>
</body>
</html>`;

fs.writeFileSync(path.join(outputDirectory, 'index.html'), indexHtml, 'utf8');
console.log(`Generated ${builtinTemplates.length} previews in ${outputDirectory}`);
'@ | node

if ($LASTEXITCODE -ne 0) {
  throw "Email preview generation failed with exit code $LASTEXITCODE."
}

$indexPath = Join-Path $resolvedOutputDirectory "index.html"
Write-Host "Preview index: $indexPath" -ForegroundColor Green

if (-not $NoOpen) {
  Start-Process $indexPath
}
