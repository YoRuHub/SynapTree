# SynapTree 🌳

**SynapTree** transforms your code structure into a stunning, interactive 3D universe. Explore your file system as a living neural network, where each node is a crystalline entity and every dependency is a flowing signal.



## ✨ Features

### 🌌 Phantasmal 3D Visualization
- **Cell-like Visuals**: Nodes are rendered as semi-transparent, glass-like entities created with `MeshPhysicalMaterial`.
- **Organic Animations**: Nodes pulse with a rhythmic "heartbeat," making the graph feel alive.
- **Ethereal Connections**: Dependencies utilize soft, phantom-like orbital lines with flowing signal particles.

### 🔍 Interactive Experience
- **Real-time Search**: Press the search icon or use `Cmd+F` to open the glassmorphism search bar. 
- **Navigation**: Use `<` and `>` buttons to cycle through search results like a playlist.
- **Ripple Highlights**: Matched nodes emit a stunning, expanding gold ripple.
- **Permanent Labels**: File names are projected as 3D text sprites below each node for instant clarity.
- **Dynamic Toggle**: Instantly show/hide labels with a dedicated toggle button ($eye / $eye-closed).

### 🎨 Deep Customization
- **Native Settings**: Fully integrated into VS Code's settings UI.
- **Color Mapping**: Assign custom colors to specific file extensions via a simple table interface.
- **Visual Tweaks**: Adjust particle speed, link opacity, and node colors to match your theme.
- **Ignore Patterns**: Exclude `node_modules`, `.git`, or any other patterns to keep your view clean.
# SynapTree 0.0.7

**Visualize your workspace like a neural network.**  
SynapTree is a VS Code extension that turns your project's file structure into an interactive 3D Force-Directed Graph.

![Demo](resources/logo.jpg)

## Features

### 🌌 Interactive 3D Graph
*   **Navigate**: Zoom, pan, and rotate around your codebase in 3D space.
*   **Click to Open**: Clicking a node instantly opens the corresponding file in VS Code.
*   **Search**: Press `Ctrl+F` (or `Cmd+F`) in the graph view to search for files by name.

### 🧬 Git Integration (New in 0.0.7)
Real-time visualization of your project's Git status.
*   **Glassy Aura**: Normal files have a subtle, glass-like white aura.
*   **Modified (Orange)**: The outer aura glows Orange when a file is modified.
*   **Untracked (Green)**: The outer aura glows Green for new (untracked) files.
*   **Staged (Bright Green)**: Staged files glow with a bright green aura.
*   *Note: Using the "Reset Settings" command can restore these defaults if you have customized them.*

### 🎨 Customizable Visuals
*   **Directories**: Default is **Blue** (#0088ff).
*   **Files**: Default is **Gray** (#aaaaaa).
*   **Extension Colors**: Map specific file extensions (e.g., `.ts`, `.rs`, `.py`) to custom colors in Settings.
*   **Reset**: A new "Trash icon" button in the menu allows you to reset all settings to defaults.

## Usage

1.  Open the **SynapTree** view in the Activity Bar (Circuit Board icon).
2.  The graph will automatically load your current workspace.
3.  **Left Click**: Rotate camera.
4.  **Right Click**: Pan camera.
5.  **Scroll**: Zoom in/out.
6.  **Click Node**: Open file / Focus directory.
7.  **Hover**: Highlight connections.

## Extension Settings

This extension contributes the following settings:

*   `synaptree.colors.directory`: Color for directory nodes.
*   `synaptree.colors.extensions`: Dictionary mapping extensions to colors.
*   `synaptree.visuals.particleSpeed`: Speed of the data flow particles.
*   `synaptree.visuals.normalOpacity`: Opacity of the connection links.
*   `synaptree.general.ignorePatterns`: Glob patterns to exclude | `["node_modules", ...]` |
*   ...and more!

## Release Notes

### 0.0.7
*   **Performance**: Async Git loading for instant startup.
*   **Visuals**: New "Glassy" node design & "Outer Aura" status indicators.
*   **DX**: Added "Reset Settings" command and improved Japanese localization.

---

**Enjoy coding in 3D!**

## 📦 Installation

Install via the VS Code Marketplace:
`ext install yoru.synaptree`

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---
*Created with ❤️ by Yoru & Antigravity (Google DeepMind)*
