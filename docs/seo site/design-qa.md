# Tellann mission and vision reveal design QA

## Source and implementation

- Source visual truth: `C:/Users/pellu/AppData/Local/Packages/Microsoft.ScreenSketch_8wekyb3d8bbwe/TempState/Recordings/20260829-0122-25.2525591.mp4`
- Source comparison frames: `C:/Users/pellu/AppData/Local/Temp/tellann-mission-reference-frames/frame-01.png` and `frame-02.png`
- Implementation default state: `C:/Users/pellu/AppData/Local/Temp/tellann-mission-base.png`
- Implementation revealed state: `C:/Users/pellu/AppData/Local/Temp/tellann-mission-hover.png`
- Mobile revealed state: `C:/Users/pellu/AppData/Local/Temp/tellann-mission-mobile.png`
- Combined comparison: `C:/Users/pellu/AppData/Local/Temp/tellann-mission-comparison.png`

## Normalization

- Source recording: 1920 x 1052 px at 30 fps, 8.66 seconds.
- Source frames: 960 x 526 px after proportional downsampling.
- Desktop implementation viewport: 1280 x 720 CSS px at density 1.
- Mobile implementation viewport: 390 x 844 CSS px at density 1.
- Comparison sheet normalizes each source and implementation state into a 640 x 360 cell without stretching.

## States tested

- Resting paired-card state.
- Mission card image-reveal state through focus, equivalent to hover styling.
- Keyboard/tap focus behavior.
- Stacked mobile reveal state.
- Dark theme and responsive overflow.

## Full-view and focused comparison

- The implementation preserves the reference's two equal panels, fixed labels, bottom-weighted headlines, circular arrows, rounded clipping, and reversible image fade.
- The revealed image uses a grayscale Tellann asset rather than the source site's green nature imagery. This is an intentional brand adaptation.
- Typography, spacing, arrow treatment, image crop, and transition state are readable in the focused 2x2 comparison sheet; no additional crop was required.

## Fidelity surfaces

- Typography: large sans-serif headlines retain consistent weight and remain anchored across states.
- Layout rhythm: panel dimensions do not move during reveal; desktop and mobile spacing remain stable.
- Colors: reference green is intentionally translated to Tellann black, white, and grayscale tokens.
- Image quality: the existing high-resolution Tellann source image remains sharp at both desktop and mobile crops.
- Copy: canonical mission and vision meaning is preserved, with supporting clauses separated for clearer card hierarchy.

## Findings and comparison history

- Initial implementation produced a 2 px mobile overflow in the broader company page. The page canvas clipping fix from the preceding company-page pass remains effective; the current mobile document is 380 x 380 CSS px with no overflow.
- The image reveal, scale settling, fixed text, and arrow inversion match the reference interaction closely. No actionable P0, P1, or P2 mismatches remain.
- P3 intentional deviation: Tellann uses one supplied monochrome portrait with different crops rather than two unrelated nature photographs.

final result: passed
