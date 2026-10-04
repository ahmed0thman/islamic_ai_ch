# Design Tokens

## Typography
- **Body Font**: `'Readex Pro', sans-serif`
  - *Reasoning*: A modern, clean, and highly readable sans-serif Arabic typeface that gives a calming, contemporary feel.
- **Quran Font**: `'Amiri', serif`
  - *Reasoning*: A classic Naskh typeface that honors the traditional typographic style of the Quran, making it visually distinct from the explanation text.
- **Base Size**: `18px`
  - *Reasoning*: Ensures a generous and accessible reading experience on mobile devices.
- **Line Height**: `1.8`
  - *Reasoning*: Ample line spacing to prevent visual clutter and maintain the "calm book" aesthetic.
- **Type Scale**:
  - `--text-xs`: `0.75rem` (13.5px) - For badges and small metadata.
  - `--text-sm`: `0.875rem` (15.75px) - For legend, footer, and secondary UI elements.
  - `--text-base`: `1rem` (18px) - For body paragraphs.
  - `--text-lg`: `1.25rem` (22.5px) - For section headings and important UI text.
  - `--text-xl`: `1.5rem` (27px) - For the Quranic text block to give it prominence.

## Colors
- **Light Theme**:
  - `--bg-primary`: `#FAFAFA` (Off-white) - *Reasoning*: Reduces eye strain compared to pure white, mimicking paper.
  - `--bg-secondary`: `#F0F0F0` - *Reasoning*: Provides subtle contrast for panels and interactive elements.
  - `--text-primary`: `#1C1C1E` - *Reasoning*: Soft black for high contrast (AA compliant) without being harsh.
  - `--text-secondary`: `#6C6C70` - *Reasoning*: De-emphasized text for metadata and disclosures.
- **Dark Theme** (via `@media (prefers-color-scheme: dark)`):
  - `--bg-primary`: `#121212` - *Reasoning*: Deep gray to reduce glare in low-light conditions.
  - `--bg-secondary`: `#1E1E1E` - *Reasoning*: Slightly lighter gray for elevation and surfaces.
  - `--text-primary`: `#E5E5E7` - *Reasoning*: Off-white text to maintain readability without blooming on dark backgrounds.
  - `--text-secondary`: `#8E8E93` - *Reasoning*: Softer gray for secondary text in dark mode.

## Semantic Colors (Icons & Badges)
- `--color-ayah`: `#2E7D32` (Green)
- `--color-hadith`: `#1565C0` (Blue)
- `--color-athar`: `#6A1B9A` (Purple)
- `--color-scholar`: `#546E7A` (Blue-grey)
- `--color-link`: `#B26A00` (Amber)
- `--color-hidaya`: `#AD1457` (Pink)
- `--badge-thabit-bg`: `#607D8B`
- `--badge-layathbut-bg`: `#B23B2E`
- `--badge-khilaf-bg`: `#00838F`
- *Reasoning*: Colors are taken verbatim from the schema, ensuring strict adherence to the brand and content specification while providing distinct visual cues.

## Spacing
- `--space-xs`: `4px`
- `--space-sm`: `8px`
- `--space-md`: `16px`
- `--space-lg`: `24px`
- `--space-xl`: `32px`
- `--space-2xl`: `48px`
- *Reasoning*: A 4px/8px baseline grid ensures consistent, rhythmic vertical and horizontal spacing.

## Radii
- `--radius-sm`: `4px` - *Reasoning*: For small, subtle elements like badges.
- `--radius-md`: `8px` - *Reasoning*: For general UI components like markers.
- `--radius-lg`: `16px` - *Reasoning*: For larger surfaces like the bottom sheet to feel soft and approachable.
- `--radius-full`: `999px` - *Reasoning*: For pill-shaped elements like the depth switch selector.

## Shadows
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.05)` - *Reasoning*: Subtle elevation for interactive elements.
- `--shadow-md`: `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)` - *Reasoning*: Medium elevation for the bottom sheet to float above the content.
- `--shadow-lg`: `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)` - *Reasoning*: For the legend panel when expanded.

## Markers & Badges Specs
- **Markers**: Minimum touch target of `44px` width/height for the interactive wrapper. The visible marker itself uses `--space-md` padding and `--radius-md`, integrating the shape icon and the reference number.
  - *Reasoning*: Adheres to accessibility guidelines for touch targets while keeping the visual element calm and unobtrusive.
- **Badges**: Font size `--text-xs`, padding `--space-xs` horizontally, `border-radius: --radius-sm`. Text color is white for `--badge-layathbut-bg` and `--badge-khilaf-bg`.
  - *Reasoning*: Provides clear, immediate contextual information without disrupting the reading flow.
