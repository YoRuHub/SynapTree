# SynapTree 0.0.8

**Visualize your workspace like a neural network.**  
SynapTree transforms your project's file structure into a stunning, interactive 3D Force-Directed Graph.

## ✨ Features

### 🌌 Interactive 3D Visualization

- **Cell-like Visuals**: Nodes feature a semi-transparent, glass-like aesthetic with an inner pulsating core.
- **Context Menu**: **Right-click** any node to access a full menu:
  - **Set as Root**: Focus the graph on a specific directory.
  - **Create**: Add new files or folders directly from the 3D view.
  - **Rename/Delete**: Manage your files without leaving the graph.
- **Auto-Focus**: Opening a file in the editor automatically centers the camera on the corresponding node (Sync).
- **Navigation**: Click nodes to open files. Use the HUD Reset button to return to the root.

### 🧬 Real-time Git Integration

See your project's pulse at a glance. Nodes react to Git status with dynamic spectral auras:

- **Modified**: glowing **Gold/Orange** aura.
- **Untracked**: glowing **Green** aura.
- **Staged**: glowing **Bright Green** aura.
- **Ignored**: dimmed or excluded based on settings.

_Updates are processed in efficient batches to ensure smooth performance even in large repositories._

### 🔍 Deep Search & Navigation

- **Search**: Press `Ctrl+F` (or `Cmd+F`) inside the graph to toggle the search bar.
- **Ripple Effect**: Matches emit a distinctive expanding ripple for easy location.
- **Cycle**: Use `<` and `>` buttons to jump between multiple search results.
- **Breadcrumbs**: Track your current location with an interactive path bar at the bottom.

### 🎨 Customization

- **Colors**: Customize directory and file colors via VS Code Settings.
- **Extension Maps**: Assign specific colors to file extensions (e.g., `.ts`, `.rs`).
- **Particles**: Adjust the speed and density of signal particles flowing through links.

## 🕹️ Controls (Mouse Operation)

| Action     | Control                     | Description                                       |
| :--------- | :-------------------------- | :------------------------------------------------ |
| **Rotate** | **Left Click + Drag**       | Rotate the camera around the current center.      |
| **Pan**    | **Right Click + Drag**      | Move the camera horizontally or vertically (Pan). |
| **Zoom**   | **Scroll Wheel**            | Zoom in and out.                                  |
| **Select** | **Left Click (Node)**       | Focus on the node and open the file.              |
| **Menu**   | **Right Click (Node)**      | Open the context menu for the node.               |
| **Reset**  | **Left Click (Background)** | Clear current selection and highlighting.         |

## 🚀 What's New in 0.0.8

- **Interactive Breadcrumbs**: A sleek, bottom-aligned path bar shows the full path of the selected node. Click path segments to navigate up the hierarchy.
- **Smart Initial Zoom**: The graph now automatically calculates the perfect zoom level to fit all nodes on screen when loaded.
- **Improved Layout**: Fixed display issues where the graph would not fill the window correctly when resizing.
- **Cleaner Default View**: Added smart ignore patterns to automatically hide clutter like `build`, `dist`, `coverage`, and dotfiles (`.*`) by default.

## Settings

- `synaptree.general.autoFocus`: Enable/Disable editor-to-graph synchronization.
- `synaptree.colors.directory`: Color for directory nodes.
- `synaptree.visuals.particleSpeed`: Flow speed of dependency links.
- `synaptree.config.general.ignorePatterns`: Configure files/folders to exclude from the graph.

---

## 📦 Installation

Install via the VS Code Marketplace:
`ext install yoru.synaptree`

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

_Created with ❤️ by Yoru & Antigravity (Google DeepMind)_
