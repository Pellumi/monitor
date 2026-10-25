# Tellann QA Report — Product Improvement Review

Assessment: Strong technical foundation, limited decision-making value

Having reviewed the 37-page QA report and Tellann’s product requirements, my central recommendation is:

Evolve the report from a record of detected problems into an evidence-backed explanation of application quality, business risk, and the next actions worth taking.

The current report already captures valuable information:

- 16 findings across four application routes.
- Browser performance, accessibility, network, and console evidence.
- 498 captured evidence events.
- Reproduction instructions and prioritized recommendations.
- Session metadata, instrumentation details, and developer annotations.

However, the report does not yet answer the questions clients are ultimately paying Tellann to answer:

1. What did we successfully verify?
2. What is broken, and how does it affect our users?
3. Which critical workflows remain unverified?
4. What should our engineering team fix first, and why?
5. What evidence proves the problem exists?
6. How will we know that the application has improved?

The most important gap is particularly revealing: despite capturing 498 events, the report shows zero observed states, zero transitions, and no meaningful workflow coverage or reconciliation results.

This matters because Tellann’s defining advantage is supposed to be its ability to compare declared application behavior against observed behavior. Without that comparison, the report resembles a conventional browser QA audit rather than Tellann’s distinctive quality intelligence product.

## 1. Fix the issues that currently undermine client trust

These are the most important problems I found in the actual report.

| Current behaviour                                                                                  | Why it is problematic                                                                                | Recommended change                                                                                             |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0 observed states and transitions, despite 498 captured events                                     | Clients cannot distinguish missing instrumentation from an application with no meaningful behaviour. | Show `Not measured`, explain why, and identify the capture capability required.                                |
| 16 separate findings, including repeated accessibility rules                                       | The report appears to contain more independent problems than may actually exist.                     | Group findings by underlying issue; retain affected routes, elements, and occurrences.                         |
| 0 critical findings in the summary, but 2 critical accessibility violations in the browser section | Different severity systems appear contradictory.                                                     | Explain technical impact versus Tellann's prioritization, including any severity mapping.                      |
| HTTP 401 treated as a defect                                                                       | A rejected login can be correct behaviour when credentials are invalid.                              | Correlate the response with form intent, authentication outcome, and expected behaviour before classifying it. |
| p75/p95 metrics calculated from as few as 1–3 samples                                              | These percentile labels suggest more statistical confidence than the evidence supports.              | Show the observed values and sample count; mark distribution estimates as insufficient where appropriate.      |
| Resources classified as not loaded because they transferred no bytes                               | Cached, empty, or intentionally bodyless responses can be mistaken for broken resources.             | Confirm HTTP status, cache behaviour, resource type, and decode failure before creating a defect.              |
| Manual session stop without a clear verification verdict                                           | A client may mistake a stopped run for a completed test.                                             | State explicitly whether the declared workflow reached its terminal checkpoint.                                |

The performance concern is especially important. Google's Web Vitals guidance uses the 75th percentile across page loads to evaluate typical user experience. A single-run observation remains useful, but it should be presented as a limited sample, not a reliable performance distribution.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://web.dev\&sz=32)

web.dev



There is also a visual problem: approximately 26 of the 37 pages are occupied by individual findings and raw evidence. The accessibility table on page 25 is especially difficult to scan.

The document needs stronger information hierarchy, not simply more information.

## 2. Redesign the first page around decisions

The first page should tell clients what the run established and what still needs investigation.

Here is how I would present this exact run.

TELLANN / QA RUN SUMMARY

# Enterprise Frontend

Development · 25 October 2026 · Frontend capture

Verification incomplete

Manual stop — workflow completion not established

Browser findings were captured, but application state and transition coverage were not established. This run cannot validate the completeness of intended workflows.

# 16

Findings detected

# 2

High priority

# 4

Routes observed

# 498

Evidence events

Immediate attention

High

Severe layout instability on `/login`

Observed CLS: 1.63. Investigate shifting elements and verify after correction.

High

Unnamed button on course page

Accessibility failure; locate the affected control and provide a meaningful accessible name.

Review

Login request returned HTTP 401

Determine whether this represents expected authentication rejection or a defect.

Verification gaps

Workflow coverage

Not measured

State and transition evidence

Unavailable

Backend instrumentation

Not enabled

Release readiness

Undetermined

Illustrative redesign using the captured report data. These are not additional test results.

This is more immediately useful to an engineering manager than the current opening page.

Notice that I deliberately did not introduce a quality score such as 72/100. Tellann’s QA Reporting Specification correctly reserves composite scores for Phase 3, when continuous evidence can justify them.

For Phase 1, an honest verification state is more valuable than manufactured precision.

## 3. Make workflow verification the centre of the product

This is the most strategically significant improvement.

The report should distinguish three questions:

- What did the client declare should happen?
- What did Tellann actually observe?
- Where do those two models disagree?

Every declared workflow should have a reconciliation summary.

| Workflow measurement    | Example interpretation                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Declared states         | States the client expects the workflow to contain                     |
| Confirmed states        | Declared states supported by observed evidence                        |
| True gaps               | Declared, reachable states not demonstrated under sufficient evidence |
| Undeclared observations | Behaviour observed but not present in declared intent                 |
| Unverified states       | States without sufficient evidence to classify                        |
| Completion status       | Whether the workflow reached a declared terminal state                |

A useful workflow visualization could distinguish confirmed, unverified, and potentially missing paths.

\#chatgpt-mermaid-\_r_3c4\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_3c4\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_3c4\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_3c4\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_3c4\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_3c4\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_3c4\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_3c4\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_3c4\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_3c4\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_3c4\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_3c4\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_3c4\_ p{margin:0;}#chatgpt-mermaid-\_r_3c4\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_3c4\_ .label text,#chatgpt-mermaid-\_r_3c4\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ .node rect,#chatgpt-mermaid-\_r_3c4\_ .node circle,#chatgpt-mermaid-\_r_3c4\_ .node ellipse,#chatgpt-mermaid-\_r_3c4\_ .node polygon,#chatgpt-mermaid-\_r_3c4\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ .rough-node .label text,#chatgpt-mermaid-\_r_3c4\_ .node .label text,#chatgpt-mermaid-\_r_3c4\_ .image-shape .label,#chatgpt-mermaid-\_r_3c4\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_3c4\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ .rough-node .label,#chatgpt-mermaid-\_r_3c4\_ .node .label,#chatgpt-mermaid-\_r_3c4\_ .image-shape .label,#chatgpt-mermaid-\_r_3c4\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_3c4\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_3c4\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_3c4\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_3c4\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_3c4\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_3c4\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_3c4\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_3c4\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_3c4\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_3c4\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_3c4\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_3c4\_ .icon-shape,#chatgpt-mermaid-\_r_3c4\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_3c4\_ .icon-shape p,#chatgpt-mermaid-\_r_3c4\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_3c4\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_3c4\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_3c4\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_3c4\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_3c4\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_3c4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_3c4\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_3c4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_3c4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3c4\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_3c4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3c4\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_3c4\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_3c4\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_3c4\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_3c4\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ .node rect,#chatgpt-mermaid-\_r_3c4\_ .node circle,#chatgpt-mermaid-\_r_3c4\_ .node ellipse,#chatgpt-mermaid-\_r_3c4\_ .node polygon,#chatgpt-mermaid-\_r_3c4\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_3c4\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_3c4\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_3c4\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_3c4\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_3c4\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}#chatgpt-mermaid-\_r_3c4\_ .observed rect{fill:rgb(220, 252, 231)!important;stroke:rgb(22, 163, 74)!important;color:rgb(20, 83, 45)!important;}#chatgpt-mermaid-\_r_3c4\_ .observed polygon{fill:rgb(220, 252, 231)!important;stroke:rgb(22, 163, 74)!important;color:rgb(20, 83, 45)!important;}#chatgpt-mermaid-\_r_3c4\_ .observed ellipse{fill:rgb(220, 252, 231)!important;stroke:rgb(22, 163, 74)!important;color:rgb(20, 83, 45)!important;}#chatgpt-mermaid-\_r_3c4\_ .observed circle{fill:rgb(220, 252, 231)!important;stroke:rgb(22, 163, 74)!important;color:rgb(20, 83, 45)!important;}#chatgpt-mermaid-\_r_3c4\_ .observed path{fill:rgb(220, 252, 231)!important;stroke:rgb(22, 163, 74)!important;color:rgb(20, 83, 45)!important;}#chatgpt-mermaid-\_r_3c4\_ .observed tspan{fill:rgb(20, 83, 45)!important;}#chatgpt-mermaid-\_r_3c4\_ .unknown rect{fill:rgb(243, 244, 246)!important;stroke:rgb(156, 163, 175)!important;color:rgb(55, 65, 81)!important;}#chatgpt-mermaid-\_r_3c4\_ .unknown polygon{fill:rgb(243, 244, 246)!important;stroke:rgb(156, 163, 175)!important;color:rgb(55, 65, 81)!important;}#chatgpt-mermaid-\_r_3c4\_ .unknown ellipse{fill:rgb(243, 244, 246)!important;stroke:rgb(156, 163, 175)!important;color:rgb(55, 65, 81)!important;}#chatgpt-mermaid-\_r_3c4\_ .unknown circle{fill:rgb(243, 244, 246)!important;stroke:rgb(156, 163, 175)!important;color:rgb(55, 65, 81)!important;}#chatgpt-mermaid-\_r_3c4\_ .unknown path{fill:rgb(243, 244, 246)!important;stroke:rgb(156, 163, 175)!important;color:rgb(55, 65, 81)!important;}#chatgpt-mermaid-\_r_3c4\_ .unknown tspan{fill:rgb(55, 65, 81)!important;}Login formCredentials submittedAuthenticatedInvalid credentialsDashboard

Illustrative declared workflow: green indicates evidence-backed observation; grey indicates a branch requiring verification. The diagram is not derived from this run.

Critically, an unobserved state must not automatically become a defect. It may simply be a path the tester never exercised.

That distinction is foundational to Tellann's architecture.

For this particular run, the report should state why browser events were captured but state/transition evidence was unavailable, and prescribe a concrete next step to enable meaningful reconciliation.

## 4. Turn every finding into an actionable investigation

The current finding pages contain severity, confidence, explanation, suggested action, and reproduction steps. That is a good foundation.

But most engineers need substantially more context to fix something quickly.

I recommend a common finding structure:

| Field                          | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| Finding identity               | Stable ID for tracking across reruns                            |
| Affected workflow and route    | Where the issue occurs                                          |
| Expected vs observed behaviour | The actual discrepancy                                          |
| User impact                    | The consequence of the discrepancy                              |
| Evidence                       | Screenshot, event IDs, trace, relevant request or DOM element   |
| Likely cause                   | Hypothesis, explicitly separated from proven facts              |
| Recommended fix                | Specific engineering direction                                  |
| Verification criteria          | How Tellann will recognize a successful correction              |
| Status                         | New, investigating, acknowledged, fixed, verified, or dismissed |

For example, rewrite the unnamed-button finding as follows:

High

Accessibility

Affected route: /course/:id/...

## Interactive button has no accessible name

Observed evidence

An accessibility scan detected an unnamed button on the course page.

Why this matters

Users relying on assistive technology may be unable to understand the button's purpose.

Recommended correction

Give the control a meaningful accessible name through visible text or appropriate accessible labelling.

Verification

- The button has a non-empty, meaningful computed accessible name.
- The accessibility rule passes during a repeated scan.
- The originally affected control is exercised again.

Evidence still needed

Exact element selector, screenshot highlighting the control, source location, and linked event or scan identifier.

That last section matters. The current report often tells developers to inspect the reported element without actually identifying it.

Also, replace generic outcomes such as “the affected interaction completes reliably” with issue-specific acceptance criteria. A color-contrast problem is fixed by meeting a contrast requirement, not necessarily by making an interaction complete.

## 5. Add evidence-driven prioritization

Severity alone is not enough. Two high-priority findings can have very different business consequences.

A useful prioritization model should consider:

- Technical severity: How serious is the failure?
- Workflow criticality: Does it affect checkout, authentication, payment, or another important process?
- Observed impact: What actually failed, and how often in the available evidence?
- Evidence confidence: Is the cause confirmed or merely suspected?
- Remediation effort: How expensive is the likely correction?

Keep these dimensions distinct. If Tellann ranks a critical accessibility violation as a high-priority finding, explain the decision.

Do not invent business impact from browser events. For a Phase 1 guided run, say “may affect authentication usability” rather than “caused a 15% loss in sign-ins.”

When production monitoring becomes available in Phase 2, rankings can incorporate actual affected sessions and workflow outcomes.

## 6. Make evidence immediately accessible

The current report demonstrates a strong commitment to auditability. However, raw evidence consumes roughly ten pages at the end of the PDF, much of it repetitive development-resource traffic.

I would move most of this into an accessible evidence explorer and retain a compact audit appendix.

Each finding should link to:

Screenshot — the affected page and highlighted component

Session moment — timestamped playback around the occurrence

Technical trace — correlated events, requests, console output, and state

Source location — file and line reference, when available

Verification evidence — corresponding results from a later corrective run

The PDF can contain authenticated, permission-checked links into the Tellann application. A separate machine-readable export can preserve the complete evidence record.

The report should remain useful even when those links cannot be opened.

The annotations section already includes screenshots and source locations. That is a good pattern to extend to actual findings.

## 7. Introduce comparison and improvement tracking

The value of Tellann should grow with repeated use.

After clients fix findings and run another demonstration, they should be able to answer:

- Which previously reported findings are now verified as resolved?
- Which still occur?
- Which cannot be rechecked because the relevant path was not exercised?
- Did state and transition coverage improve?
- Was the new run performed under comparable conditions?

I would introduce a Fix Verification section before building broader quality trends.

A comparison should always expose its basis: same workflow, relevant instrumentation, mode, environment, and comparable evidence scope.

Tellann's specifications place full regression intelligence in Phase 3. That boundary is sensible. Earlier versions can still support factual rerun verification without claiming comprehensive regression detection.

## 8. Optimize the report for different audiences

Not every client stakeholder should have to read the same 37-page document.

| Reader              | Primary question                         | Best presentation                                              |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| Engineering manager | What requires attention before release?  | Executive summary, verified risks, unknowns, priorities        |
| QA engineer         | What was and wasn't tested?              | Workflow coverage, gaps, reproduction, verification            |
| Developer           | Where is the issue, and how do I fix it? | Evidence, trace, source location, concrete acceptance criteria |
| Product manager     | Which user journeys are affected?        | Workflow-level impact and verified behaviour                   |
| Technical auditor   | Can I trust these conclusions?           | Methodology, provenance, scope, immutable evidence             |

The PDF should support all these needs through layered detail.

A practical structure would be:

1. Executive decision summary — 1 page
2. Run coverage and verification limits — 1 page
3. Workflow reconciliation — 1–2 pages
4. Prioritized findings — 2–3 pages
5. Finding details — grouped by issue
6. Evidence and instrumentation appendix — compact, with references to full records

A short, useful report can coexist with a detailed technical export.

## 9. Prioritized implementation roadmap

P0 — Make the report trustworthy

Start here

- Correct zero versus not-measured states.
- Show incomplete-run and evidence-limit warnings.
- Explain severity mappings.
- Flag contextual findings such as HTTP 401 for verification.
- Suppress misleading percentile and resource-failure conclusions.
- Redesign the executive summary.

P1 — Reduce investigation time

- Deduplicate findings and correlate related symptoms.
- Add screenshots, selectors, timestamps, and event references.
- Generate issue-specific fixes and acceptance criteria.
- Add issue status and rerun verification.

P2 — Deliver Tellann's core differentiation

- Improve state and transition instrumentation.
- Render declared-versus-observed workflow reconciliation.
- Distinguish confirmed, true-gap, undeclared, and insufficient-evidence cases.
- Provide workflow-specific coverage and investigation.

P3 — Demonstrate ongoing customer value

- Track verified fixes and investigation outcomes.
- Compare evidence across compatible runs.
- Later introduce production-impact prioritization, regression intelligence, and justified quality scoring according to the product phases.

## 10. How to measure whether the new report provides value

Don't measure report quality by PDF length or number of generated findings.

Measure whether it improves the engineering process.

I would track five product KPIs:

| KPI                                                                | What it demonstrates                             |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| Time from report opening to first actionable investigation         | How quickly Tellann provides direction           |
| Percentage of findings with reproducible evidence                  | Whether findings can be investigated efficiently |
| Percentage of findings accepted as valid after triage              | Signal quality versus noise                      |
| Percentage of fixes independently verified by rerun                | Whether Tellann closes the quality feedback loop |
| Percentage of critical declared workflows with sufficient evidence | Whether Tellann is fulfilling its core purpose   |

These can become internal product-quality indicators long before Tellann introduces a client-facing composite quality score.

## My strategic recommendation

The real opportunity isn't to compete on how many errors Tellann detects. Traditional scanners and observability systems already provide extensive technical telemetry.

Tellann's advantage should be its ability to establish an evidence-backed relationship between what software was intended to do, what it actually did, what remains unknown, and what should happen next.

The MVP scope and QA Reporting Specification already articulate much of this vision. The work now is to make it visible, intelligible, and useful inside the customer report.

If I were choosing only three improvements for the next iteration, they would be:

1. An honest, decision-oriented executive summary with clear evidence limitations.
2. Actionable, deduplicated findings with direct proof and verification criteria.
3. Declared-versus-observed workflow reconciliation, making the report unmistakably Tellann rather than a generic browser audit.

That combination changes the customer's experience from reading a list of problems to understanding what was verified, what needs attention, and how to prove that their application is improving.