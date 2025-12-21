# Change Log

## [0.0.7] - 2025-12-21
### Added
- **Real-time Git Integration**: Git status updates are now reflected instantly without reloading the graph.
- **Glassy Visual Design**: Nodes now feature a "Glass-like" white aura by default, adding depth to the visualization.
- **Reset Settings Command**: Added a "Reset Settings" button in the view title menu to easily restore default configurations.
- **New Default Colors**: modernized default color scheme (Directory: Blue, File: Gray).
- **Untracked File Support**: Newly created files are now correctly detected and visualized in Green.

### Changed
- **Async Loading**: Decoupled Git scanning from the main graph loading process to prevent freezing on startup.
- **Visual Mechanics**: Git status (Modified/New) now only affects the outer aura, preserving the node's base color (Inner Core) for better recognition.
- **Settings Descriptions**: Rewrote settings descriptions (English & Japanese) for better clarity.

### Fixed
- Fixed an issue where new files (Untracked) were displayed with the wrong color.
- Fixed performance issues during initial load.

## [0.0.6] - 2025-12-21
### Added
- **High-Quality Node Visuals**: Nodes now feature a semi-transparent, cell-like glass effect (`MeshPhysicalMaterial`) for a premium look.
- **Search Navigation**: Replaced the search close button with Previous/Next (`<` `>`) buttons to cycle through matched nodes.
- **Ripple Effect**: Enhanced search result animation with a high-resolution, gold-colored expanding ripple ring.
- **Auto-Focus**: Camera automatically transitions to focus on the selected search result.

### Changed
- Improved node material quality for better depth and transparency.
- Refined search UI to only show navigation buttons when matches are found.

## [0.0.5] - 2025-12-21
### Fixed
- Updated repository metadata in `package.json` to point to the correct public URL.
- Fixed LICENSE link in `README.md`.
- Removed experimental file management features to ensure stability.

## [0.0.4] - 2025-12-21
### Added
- **Movable Root Node**: The root node is now unlocked and can be dragged freely like other nodes.
- **Distinct Root Color**: Root node can now be customized via `synaptree.colors.root` setting (default: `#ff0055`).

## [0.0.3] - 2025-12-21
### Fixed
- Updated CHANGELOG to reflect recent fixes.

## [0.0.2] - 2025-12-21
### Fixed
- Fixed `.vscodeignore` to correctly include `src/webview` assets, resolving blank screen issues in the packaged extension.

## [0.0.1] - 2025-12-21
- Initial release.
