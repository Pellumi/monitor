---
name: Obsidian Intelligence
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c8c6c5'
  on-secondary: '#303030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffffff'
  on-tertiary: '#303031'
  tertiary-container: '#e3e2e2'
  on-tertiary-container: '#646464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  headline-xl:
    fontFamily: Poppins
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Poppins
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Poppins
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Poppins
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  button:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  nav-link:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: '1.4'
  data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system embodies a "Premium Technical" aesthetic, shifting from neon glow to a high-contrast, monochrome discipline. It is engineered for precision, clarity, and authority in data-heavy environments. The brand personality is clinical yet sophisticated—evoking the feeling of a high-end surveillance suite or a mission-control dashboard.

The visual style leans into **Minimalism** with a touch of **Glassmorphism**. It utilizes pure blacks and optical whites to create a stark hierarchy, while subtle charcoal layers provide the necessary depth for complex information architecture. The user should feel in total control of the "invisible" data, reflected through a UI that is razor-sharp and devoid of visual noise.

## Colors

The palette is strictly monochrome to ensure focus remains on data and actionable insights. 

- **Pure Black (#000000):** Used for the primary background to achieve true obsidian depth and high contrast.
- **Charcoal (#262626):** Used for secondary surfaces, containers, and card backgrounds to create a subtle separation from the abyss.
- **Neutral Accent (#757575):** Reserved for borders, inactive states, and secondary metadata to recede from the primary focus.
- **Highlight White (#FFFFFF):** The primary engine for action. Used for high-priority text, primary icons, and call-to-action buttons.

This system relies on "luminance hierarchy"—the brighter the element, the more critical the information or action.

## Typography

This system uses a dual-font strategy to separate intent. 

**Poppins** handles the "Human" layer: marketing copy, navigation, headers, and general UI instructions. It is approachable yet geometric, maintaining a modern professional tone.

**JetBrains Mono** handles the "Machine" layer: everything technical. All IDs, timestamps, logs, and metrics must be rendered in this monospaced typeface to ensure horizontal alignment and a distinct visual "technical" signature.

For mobile, `headline-xl` should scale down to 32px and `headline-lg` to 24px. Body sizes remain consistent to ensure legibility.

## Layout & Spacing

The layout philosophy follows a **Fixed-Fluid Hybrid** grid. On desktop, content is contained within a maximum width of 1440px using a 12-column grid. On mobile, it switches to a 4-column fluid layout.

Spacing is based on a strict 4px/8px baseline rhythm. This "tight" spacing model reinforces the technical, data-dense nature of the product. 
- Use **40px (lg)** spacing between major sections.
- Use **24px (md)** for standard component gaps.
- Use **8px (xs)** for grouping related elements (labels and inputs).

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Low-Contrast Outlines** rather than traditional drop shadows.

1.  **Level 0 (Background):** Pure Black (#000000). The infinite canvas.
2.  **Level 1 (Surface):** Charcoal (#262626). Used for cards and sidebar containers. Borders should be a subtle Neutral Accent (#757575) at 30% opacity.
3.  **Level 2 (Popovers/Modals):** Lighter Charcoal (#333333). These use a distinct 1px Highlight White border at 15% opacity and a backdrop blur (20px) to separate from the content below.

Avoid heavy shadows. If a shadow is required for extreme depth, use a sharp, 0-spread black shadow to maintain the "hard-edge" aesthetic.

## Shapes

The shape language is "Soft-Technical." Elements use a subtle **0.25rem (4px)** radius to prevent the UI from feeling aggressive or dated, while maintaining a structured, architectural feel. 

- **Standard Elements:** 4px radius (inputs, buttons, cards).
- **Interactive Tags/Chips:** 2px radius (near-sharp).
- **System Icons:** Should follow a 2px stroke weight with consistent 1px rounded terminals.

## Components

### Buttons
- **Primary:** Solid Highlight White fill with Pure Black text. Bold Poppins 500. No border.
- **Secondary:** Transparent background with a 1px Charcoal border. White text.
- **Ghost:** No border or background. Neutral Accent text, switching to White on hover.

### Inputs
- Background: Pure Black.
- Border: 1px Charcoal. 
- Focus State: 1px Highlight White border.
- Font: JetBrains Mono for the input value; Poppins for the label.

### Cards & Containers
- Background: Charcoal (#262626).
- Border: 1px at 20% opacity Neutral Accent.
- Header: Separated by a thin horizontal rule.

### Data Chips
- Background: Neutral Accent (#757575) at 15% opacity.
- Font: JetBrains Mono (sm).
- Border: 1px solid Neutral Accent (#757575).

### Technical Logs
- Always use a Pure Black block with a 1px Charcoal border.
- Text: JetBrains Mono in Neutral Accent (#757575).
- Highlights: Use Highlight White for variables or keys within the logs.