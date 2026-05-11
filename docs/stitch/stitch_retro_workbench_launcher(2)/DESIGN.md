---
name: Retro-Modern Workbench
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bec7d3'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#88929d'
  outline-variant: '#3e4851'
  surface-tint: '#93ccff'
  primary: '#93ccff'
  on-primary: '#003351'
  primary-container: '#00aaff'
  on-primary-container: '#003c5d'
  inverse-primary: '#006398'
  secondary: '#ffb781'
  on-secondary: '#4e2600'
  secondary-container: '#ff8a0d'
  on-secondary-container: '#623000'
  tertiary: '#00e55b'
  on-tertiary: '#003911'
  tertiary-container: '#00bb48'
  on-tertiary-container: '#004214'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#ffdcc4'
  secondary-fixed-dim: '#ffb781'
  on-secondary-fixed: '#2f1400'
  on-secondary-fixed-variant: '#6f3800'
  tertiary-fixed: '#6bff83'
  tertiary-fixed-dim: '#00e55b'
  on-tertiary-fixed: '#002107'
  on-tertiary-fixed-variant: '#00531b'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Anybody
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Anybody
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Anybody
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Anybody
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-padding: 12px
  border-width: 2px
  window-header-height: 32px
---

## Brand & Style

This design system blends the nostalgic, utilitarian aesthetics of 1980s-90s computing with modern high-fidelity execution. It is built for power users, developers, and enthusiasts who value high-density information environments and the distinct "machine" aesthetic of the Amiga era.

The design language is **Modernized Retro-Brutalism**. It utilizes the "window" metaphor—not as a skeletal frame, but as a heavy, structural container. The atmosphere is nocturnal and immersive, evoking the glow of a high-end CRT monitor in a dark room. Every interaction should feel tactile and "mechanical," reinforced by scanline textures and luminous hover states that mimic phosphor persistence.

## Colors

The palette is anchored in deep, "infinite" blacks to maximize the contrast of the vibrant accent colors. 

- **Electric Blue (#00AAFF):** The primary action color, used for navigation, active window borders, and primary buttons.
- **Neon Orange (#FF8800):** The warning and highlight color, used for critical data points, alerts, and secondary interactive elements.
- **Cyber Green (#00FF66):** The "system-ok" color, reserved for success states, data streams, and terminal-style readouts.
- **Neutrals:** The background uses `#121212` for the foundation, while `#1A1A1A` defines container surfaces. Borders use a mid-tone charcoal to maintain structure without breaking the dark immersion.

Apply a 2% opacity "Scanline" overlay (horizontal repeating lines) across the entire UI to unify the palette and reinforce the emulator aesthetic.

## Typography

This design system uses a dual-font strategy to balance character with readability.

1.  **Headings (Anybody):** A chunky, expressive sans-serif. Use high weights (700-800) to create a sense of physical weight and presence. It should feel industrial and "heavy."
2.  **Data & Body (JetBrains Mono):** A pixel-perfect monospace font that provides the technical, "Workbench" feel. It ensures that tabular data, logs, and labels align to a predictable grid.

**Styling Note:** For primary headings, use a subtle text-shadow of the primary color (`#00AAFF`) with a 0px blur and 2px offset to mimic hardware-based chromatic aberration.

## Layout & Spacing

The layout is strictly modular, following a **Fixed Grid** philosophy inspired by multi-window desktop environments.

- **Main Structure:** A permanent 48px Top Bar for system-wide utilities and a 200px Left Sidebar for primary navigation.
- **Containers:** Content is housed in "Window" components. These windows do not float randomly but snap to a 12-column grid with 16px gutters.
- **Rhythm:** Spacing is strictly based on a 4px baseline. All padding and margins must be multiples of 4 (4, 8, 12, 16, 24, 32).
- **Mobile Adaptivity:** On mobile, windows stack vertically and the left sidebar transforms into a bottom docked navigation bar. Headers scale down to `headline-lg-mobile`.

## Elevation & Depth

Depth is conveyed through **Bold Borders** and **Phosphor Glows** rather than realistic shadows.

- **The Window Stack:** Layers are defined by their border intensity. The "Active" window has a 2px Electric Blue border with a `0 0 10px` outer glow. Background windows have a 2px Charcoal border and no glow.
- **Z-Axis Hierarchy:**
    - **Level 0 (Desktop):** `#121212` background.
    - **Level 1 (Inactive Window):** `#1A1A1A` surface, charcoal border.
    - **Level 2 (Active Window):** `#1A1A1A` surface, blue border + glow.
    - **Level 3 (Pop-ups/Modals):** Same as Active Window but with a 50% opacity black backdrop overlay to dim the "desktop" behind it.
- **Interactive Elements:** Buttons and inputs use a "pressed" state where the border shifts color and the internal background darkens, simulating a physical mechanical switch being depressed.

## Shapes

The shape language is strictly **Sharp (0px)**. To maintain the Amiga/Retro aesthetic, no rounded corners are permitted. 

- **Bevels:** Instead of curves, use 45-degree chamfers for "pixel-cut" corners on specialized buttons or decorative elements.
- **Borders:** All containers must have a consistent 2px solid border. 
- **Icons:** Use a 16x16 or 24x24 pixel grid for icons. Strokes should be 2px thick to match the container borders, ensuring they feel like part of the interface’s "wiring."

## Components

### Buttons
Buttons are rectangular with a 2px border. 
- **Primary:** Electric Blue border, transparent background, blue text. On hover, the background fills with Blue and text becomes Black. 
- **Ghost:** Charcoal border, Grey text. On hover, border turns Green.

### The "Window" Container
The primary organizational unit. It consists of:
1.  **Header:** A 32px tall bar with a solid background color (Blue for active, Charcoal for inactive) containing the title in `label-md` and "minimize/close" pixel-art icons.
2.  **Body:** `#1A1A1A` background with `container-padding`.

### Input Fields
Inputs are recessed. Use a darker background (`#080808`) than the surface, with a 2px bottom border only. When focused, the border becomes Green and a "block" cursor (non-blinking or slow-pulsing) appears.

### Lists & Navigation
Sidebar items use high-contrast hover states. When hovered, the entire row should highlight with a Cyber Green background and black text, creating a "selection bar" effect typical of BIOS or early OS menus.

### Scanline Overlay
Apply a global CSS overlay:
```css
.scanline-effect {
  background: linear-gradient(
    to bottom,
    rgba(18, 16, 16, 0) 50%,
    rgba(0, 0, 0, 0.15) 50%
  );
  background-size: 100% 4px;
  pointer-events: none;
}
```