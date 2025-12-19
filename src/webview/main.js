const vscode = acquireVsCodeApi();
const elem = document.getElementById('graph');

const Graph = ForceGraph3D()(elem)
    .nodeAutoColorBy('type')
    .nodeLabel(node => `<div class="node-label">${node.name}</div>`)
    .nodeRelSize(4)
    .linkColor(() => 'rgba(255, 255, 255, 0.1)')
    .linkWidth(0.5)
    .linkDirectionalParticles(3)
    .linkDirectionalParticleSpeed(d => 0.005)
    .linkDirectionalParticleWidth(1.5)
    .backgroundColor('#000000')
    .onNodeClick(node => {
        if (node.type === 'file') {
            vscode.postMessage({
                command: 'openFile',
                path: node.path
            });
        }
    });

// Neo-Synapse Styling with Three.js
Graph.nodeThreeObject(node => {
    const isDir = node.type === 'directory';
    const color = isDir ? '#ff00ff' : '#00ffff'; // Magenta for dirs, Cyan for files
    const size = isDir ? 6 : 3;

    // Create a group for the node
    const group = new THREE.Group();

    // Core sphere
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(size),
        new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            emissive: color,
            emissiveIntensity: 0.8
        })
    );
    group.add(sphere);

    // Outer glow (halos)
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.5),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2
        })
    );
    group.add(glow);

    return group;
});

// Particle Flow Styling
Graph.linkThreeObjectExtend(true)
    .linkDirectionalParticleColor(() => '#ffffff')
    .linkDirectionalParticleWidth(2);

// Force Simulation Tweaks
Graph.d3Force('charge').strength(-120);
Graph.d3Force('link').distance(50);

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'setData':
            Graph.graphData(message.data);
            break;
    }
});

// Resize handler
window.addEventListener('resize', () => {
    Graph.width(window.innerWidth);
    Graph.height(window.innerHeight);
});
