# SynapTree 🌳

**SynapTree** transforms your code structure into a stunning, interactive 3D universe. Explore your file system as a living neural network, where each node is a crystalline entity and every dependency is a flowing signal.

![SynapTree Visualization](https://raw.githubusercontent.com/yoru/SynapTree/main/resources/preview.png)

## ✨ Features

### 🌌 Phantasmal 3D Visualization
- **Crystalline Nodes**: Directories and files are rendered as glowing Icosahedrons.
- **Organic Animations**: Nodes pulse with a rhythmic "heartbeat," making the graph feel alive.
- **Ethereal Connections**: Dependencies utilize soft, phantom-like orbital lines with flowing signal particles.

### 🔍 Interactive Experience
- **Real-time Search**: Press the search icon or use `Cmd+F` to open the glassmorphism search bar. 
- **Supernova Highlights**: Matched nodes emit a high-intensity, stable flickering glow.
- **Permanent Labels**: File names are projected as 3D text sprites below each node for instant clarity.
- **Dynamic Toggle**: Instantly show/hide labels with a dedicated toggle button ($eye / $eye-closed).

### 🎨 Deep Customization
- **Native Settings**: Fully integrated into VS Code's settings UI.
- **Color Mapping**: Assign custom colors to specific file extensions via a simple table interface.
- **Visual Tweaks**: Adjust particle speed, link opacity, and node colors to match your theme.
- **Ignore Patterns**: Exclude `node_modules`, `.git`, or any other patterns to keep your view clean.

## 🚀 Getting Started

1. Open any workspace in VS Code.
2. Click the **SynapTree** icon in the Activity Bar.
3. Click **"Visualize"** to generate the 3D graph.
4. **Interact**:
    - **Left Click**: Rotate camera.
    - **Right Click**: Pan camera.
    - **Scroll**: Zoom in/out.
    - **Click Node**: Highlight connected subtrees.

## ⚙️ Configuration

Access settings via the **Gear Icon** in the SynapTree view title or standard VS Code settings (`SynapTree`).

| Setting | Description | Default |
| :--- | :--- | :--- |
| `synaptree.colors.directory` | Color for directory nodes | `#ff00ff` |
| `synaptree.colors.defaultFile` | Default color for files | `#00ffff` |
| `synaptree.colors.extensions` | Map extensions (e.g., `.ts`) to colors | `{}` |
| `synaptree.visuals.particleSpeed` | Speed of signal particles | `0.005` |
| `synaptree.general.ignorePatterns` | Glob patterns to exclude | `["node_modules", ...]` |

## 📦 Installation

Install via the VS Code Marketplace:
`ext install yoru.synaptree`

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---
*Created with ❤️ by Yoru & Antigravity (Google DeepMind)*
