# Surah Map Design Tokens

## Components

### 1. Surah Line
- **Description**: The vertical axis representing the flow of the surah.
- **Visuals**: 2px width, colored `--border-color`.
- **Spacing**: Placed on the right side of the screen, providing ample space for branches to extend to the left.

### 2. Ayah Station
- **Description**: A node on the Surah Line indicating an Ayah.
- **Data Needs**: Ayah number (optional, for the dot if needed), short Ayah text.
- **Visuals**: A 16px circular dot (`--bg-primary` fill, `--color-ayah` border). Accompanied by the short Ayah text in the Quran font (`--text-lg`, `--color-text-primary`).
- **Spacing**: Separated from the next station by `--space-xl`.

### 3. Stop Card
- **Description**: A small interactive card branching off an Ayah Station, representing a piece of knowledge.
- **Data Needs**: Title string, Icon type (scholar, hadith, athar, etc.).
- **Visuals**: Background `--bg-primary`, border 1px `--border-color`, shadow `--shadow-sm`, border-radius `--radius-md`.
- **Sizes & Tap Targets**: Padding `--space-sm` vertically and `--space-md` horizontally. Enforces a minimum tap target of 44px (`min-height: 44px`).

### 4. Branch
- **Description**: The visual connector between the Surah Line and a Stop Card.
- **Visuals**: A 2px solid horizontal line (`--border-color`) bridging the gap between the vertical axis and the card.

### 5. Cross-Surah Link
- **Description**: A special Stop Card navigating to a related Surah.
- **Data Needs**: Title string.
- **Visuals**: Same base styles as a Stop Card, but the branch connector is a 2px dashed line colored `--color-link`. The icon is the ⇄ symbol.

### 6. Hidaya Station
- **Description**: The final station on the Surah Line, representing a life lesson.
- **Data Needs**: Title string.
- **Visuals**: A 28px circular dot bordered by `--color-hidaya` (2px). Contains the ✦ icon. Text is bold and colored `--color-hidaya`.
- **Spacing**: Separated from the last stop branches by `--space-xl`.

### 7. Stop Scene
- **Description**: The view when a Stop Card is opened to read the content.
- **Data Needs**: Ayah text, Title string, Sentences array (with inline markers), Next stop reference.
- **Visuals**: Pinned Ayah at the top (`position: sticky`, background `--bg-primary`, border-bottom `--border-color`, shadow `--shadow-sm`). Title in `--text-lg`. Sentences in `--text-base`. The "Next" choice is a prominent block (`--bg-secondary`) with a minimum 44px height.

### 8. Glance Card
- **Description**: The single card view for Level 0 (اللمحة).
- **Data Needs**: Question string, Answer string, Ayah text, Marker data.
- **Visuals**: Background `--bg-primary`, border-radius `--radius-lg`, shadow `--shadow-md`. Generously padded with `--space-xl`. Big question in `--text-xl` bold. Highlighted Ayah with `--bg-secondary`.

### 9. Passage Station
- **Description**: A station representing a group of Ayahs for long Surahs.
- **Data Needs**: Passage title (represented as a placeholder), Ayah range (represented as a placeholder).
- **Visuals**: Neutral layout using a 16px rounded-square dot. Text is replaced by grey placeholder bars (`--bg-tertiary`) to convey structure without textual burden.

## States
- **Visited**: Lower opacity (e.g., `opacity: 0.6`) or a subtle checkmark indicating the user has already read this stop.
- **Current**: Highlighted background (`--bg-secondary`) or a bolder border (`border-color: var(--color-scholar)`).
- **Not Yet**: Default standard appearance (background primary, normal border, full opacity).

## Motion & Accessibility
- **Motion**: Subtle transitions (`transition: all 0.2s ease`) for hover/active states on cards and buttons, and for opening scenes.
- **Reduced Motion**: All animations and transitions must respect system preferences via `@media (prefers-reduced-motion: reduce)` by disabling transitions (`transition: none !important`).
- **Tap Targets**: All interactive elements (Stop Cards, Next Buttons, Source Markers, Close Buttons, Depth Tabs) are strictly designed with a minimum tap target of `44x44px` to ensure mobile accessibility.
