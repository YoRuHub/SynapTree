# Change Log

## [0.1.6] - 2026-01-06

### Fixed
- **Auto-Recovery**: Implemented a comprehensive auto-recovery mechanism. The extension now automatically detects and recovers from "stalled" processes during massive file operations (Watchdog) and runtime errors in the webview.
- **Improved Stability**: Fixed a potential deadlock in the file change processor that could occur during rapid file system events.
- **Resource Management**: Optimized cleanup logic to prevent memory leaks in background monitoring processes.

## [0.1.5]
- Fix: Resolved issue where extension would not load in release version due to missing dependencies.

## [0.1.4] - 2025-12-24

### Fixed
- **Performance Fixes**: Optimized mass file operation handling and webview rendering for better scalability.

### Changed
- **Visuals**: Increased the aura size for modified and untracked files for better visibility.

## [0.1.3] - 2025-12-23

### Fixed
- **Git Status Bug**: Fixed an issue where newly created or renamed files would not immediately reflect their Git status (color) in the graph. The graph now accurately updates the node color (e.g., Untracked Green) instantly upon creation.

### Documentation
- **Visual Showcase**: Updated README with new screenshots demonstrating key features (Context Menu, Search Ripple, Panel View, Root Focus).


## [0.1.2] - 2025-12-22

### Added
- **Incremental Graph Updates**: The graph now updates instantly when files are created, deleted, or renamed, without requiring a full reload. This significantly improves performance.

### Fixed
- **Label Sync**: Fixed an issue where the label visibility usage (Icon state) could get out of sync with the actual graph display.

## [0.1.1] - 2025-12-22
- Internal release (Skipped).

## [0.1.0] - 2025-12-22

- Design improvements

## [0.0.9] - 2025-12-22

### Added

- **Node Icons**: File nodes now display their respective file type icons (e.g., TS, JS, CSS, Media) directly on the node, dramatically improving visual recognition.
- **Enhanced Context Menu**: Added "Set as Root" (Open in Sidebar) and "Open in Editor" (Focus) options to the folder context menu for more flexible navigation workflow.
- **Media Support**: Added specific icons and colors for image, video, and audio files.

### Fixed

- **Performance Stability**: Implemented a concurrency limiter for file scanning to prevent crashes ("EMFILE" errors) in large repositories.
- **Initialization Deadlock**: Resolved a critical bug where the graph would fail to load (black screen) due to a deadlock in the scanning logic.
- **Visual Polish**: Disabled the automatic "zoom out" animation on load for a stable initial view.

## [0.0.8] - 2025-12-21

### Added

- **Interactive Breadcrumbs**: Added a clickable path navigation bar at the bottom of the screen to easily visualize and navigate the directory hierarchy.
- **Smart Zoom**: The graph now automatically adjusts the camera distance on load to ensure all nodes are visible (`zoomToFit`).
- **Mouse Controls Guide**: Added detailed mouse operation instructions to README.

### Changed

- **Default Ignore Patterns**: Expanded default ignore list to include `build`, `coverage`, `Pods`, `DerivedData`, and all dotfiles (`.*`) to reduce graph clutter.
- **Improved Layout**: Fixed an issue where the graph would not resize correctly when the window was resized.
- **UI Refinements**: Polished the breadcrumb UI to be unobtrusive (compact, bottom-left, transparent).

## [0.0.7] - 2025-12-21

### Added

- **Git Status Visualization**: Nodes now dynamically reflect Git status (Modified, Untracked, Staged) with distinct colored auras, updating in real-time.
- **Interactive Context Menu**: Introduced a full-featured right-click context menu for nodes, enabling actions like "Set as Root", "New File/Folder", "Rename", and "Delete".
- **Editor Sync**: Added an "Auto-Focus" setting (`synaptree.general.autoFocus`) to automatically highlight and center the node in the graph when you open a file in the editor.

### Changed

- **Performance Optimization**: Significantly improved performance when switching branches or handling large Git changes by implementing batch processing, preventing UI freezes.
- **Visuals**: The Root node is now rendered as a distinct sphere to make it easily recognizable.
- **Cleanup**: Removed all debug logging for a cleaner experience.

### Fixed

- Fixed localization logic for better compatibility.
- Fixed performance bottlenecks in large repositories.

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
