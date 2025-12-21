# Change Log

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
