# Documentation visual fidelity ledger

Last reviewed: 2026-09-06

## Acceptance references

| Surface | Approved reference | Implementation evidence |
| --- | --- | --- |
| Homepage | `exec-3ae6c2c6-58dd-4241-ae5d-083778b7ba03.png` at 1586 × 992 | `docs-home-1586x992-accepted.png` at 1586 × 992 |
| Article | `exec-247efffa-3f29-4dab-b6f7-08359c13039d.png` at 1586 × 992 | `docs-guided-1586x992-accepted.png` at 1586 × 992 |
| Mobile navigation | `exec-0422ce91-c566-47c0-9f26-1097050b9408.png` | `docs-drawer-390x844-accepted.png` at 390 × 844 CSS pixels |

The implementation screenshots are stored under `C:/Users/pellu/.codex/visualizations/2026/09/06/01a077cc-69ac-75d0-a1bd-881a3e9417e9`.

## Sign-off ledger

| Area | Target | Implemented result | Status |
| --- | --- | --- | --- |
| Layout | Quiet header, sticky left navigation, centered article, sticky right rail | Desktop shell preserves all four zones without horizontal overflow; homepage keeps the same shell and task-first hierarchy | Accepted |
| Typography | Inter, large direct headlines, compact monospace utility labels | Inter is loaded through Next font; display, body, metadata, breadcrumb, and label scales follow the reference hierarchy | Accepted |
| Palette | True black default, restrained white/gray contrast, thin borders, complete light equivalent | Dark and light semantic tokens cover backgrounds, text, borders, badges, code, controls, and focus states | Accepted |
| Navigation density | Dense but readable five-region tree with one current-page treatment | Section grouping, indentation, persistent expansion, scroll containment, badges, and external links match the approved density | Accepted |
| Active states | Weight, background, border, and `aria-current`; never color alone | Current page and active heading use multiple visual signals and semantic state | Accepted |
| Homepage container | Large editorial hero, seven-step lifecycle, six task rails, five persona pathways, quickstart band | All required content is present in the approved ordering and fits the reference viewport without horizontal overflow | Accepted |
| Article container | Readable measure, pronounced title, restrained metadata, TOC aligned to the article header | Guided demonstrations is the representative acceptance page; all seven headings appear in the right rail | Accepted |
| Mobile drawer | Narrow independent panel, visible backdrop, focus containment, close affordance, large targets | Drawer is 320 × 844 at a 390 × 844 viewport; body scrolling locks; every interactive target is at least 44px high; navigation closes cleanly | Accepted |
| Mobile article navigation | Replace desktop right rail with an accessible disclosure | The 48px “On this page” disclosure exposes headings, edit, and issue links without page overflow | Accepted |
| Responsive behavior | No clipped primary content or horizontal overflow at desktop, tablet, and phone widths | Checked at 1586px, intermediate widths, and 390px; desktop rails collapse into mobile controls as intended | Accepted |
| Motion and focus | Motion limited to disclosure/drawer/state changes and disabled when reduced motion is requested | Reduced-motion rules remove transitions and animations; keyboard focus remains visible | Accepted |

## Resolved acceptance mismatches

- Removed the marketing announcement strip and reduced header noise.
- Kept `START → Overview` authoritative rather than reproducing the accidental concept nesting.
- Rebalanced homepage vertical spacing so the quickstart band is visible at the approved desktop height.
- Removed duplicate command-palette shortcut registration from compact navigation.
- Raised the mobile product/support links from 30px to 44px minimum targets.
- Replaced client-rendered structured-data and theme scripts with warning-free rendering paths while retaining JSON-LD and theme persistence.

## Browser acceptance notes

- Homepage and Guided demonstrations: one `h1`, no horizontal overflow, no warning/error logs.
- Mobile drawer: active page visible, 320px width, 44px minimum targets, body scroll lock and unlock verified.
- Custom 404: semantic `main`, one `h1`, no horizontal overflow, no warning/error logs.
- Light theme, search keyboard flow, redirect behavior, representative content types, API console safety states, and sitemap output were also exercised.
