const vscode = acquireVsCodeApi();
console.log('WebView: main.js script execution started');

const status = document.getElementById('status');
const elem = document.getElementById('graph');

// Global animation list
const pulseObjects = [];

// 1. Register listener IMMEDIATELY to avoid missing messages
window.addEventListener('message', event => {
    const message = event.data;
    console.log('WebView: Received message', message.command);

    if (message.command === 'setData') {
        if (status) status.style.display = 'none';

        if (message.data && message.data.nodes && message.data.nodes.length > 0) {
            console.log(`WebView: Setting graph data with ${message.data.nodes.length} nodes`);
            // Clear old pulse objects if any
            pulseObjects.length = 0;
            Graph.graphData(message.data);

            // Auto-focus camera if it's the first data
            Graph.zoomToFit(400);
        } else {
            console.warn('WebView: Received empty or invalid data');
            if (status) {
                status.style.display = 'block';
                status.innerText = 'No files found in workspace';
            }
        }
    }
});

// 2. Check for libraries
if (typeof THREE === 'undefined') {
    console.error('THREE is not defined');
    if (status) status.innerText = 'Error: Three.js failed to load';
} else if (typeof ForceGraph3D === 'undefined') {
    console.error('ForceGraph3D is not defined');
    if (status) status.innerText = 'Error: 3d-force-graph failed to load';
} else {
    console.log('WebView: Libraries detected, initializing Graph');
    if (status) status.innerText = 'Libraries loaded, ready for data...';
}

// 3. Initialize Graph
const Graph = ForceGraph3D()(elem)
    .nodeAutoColorBy('type')
    .nodeLabel(node => `<div class="node-label">${node.name}</div>`)
    .nodeRelSize(4)
    .linkColor(() => 'rgba(200, 200, 255, 0.2)')
    .linkWidth(1)
    .linkCurvature(0.2)
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(0.005)
    .backgroundColor('#00050a')
    .onNodeClick(node => {
        if (node.type === 'file') {
            vscode.postMessage({ command: 'openFile', path: node.path });
        }
    });

// Custom rendering (Biological Synapse Look)
Graph.nodeThreeObject(node => {
    const isDir = node.type === 'directory';
    const color = isDir ? '#ff00ff' : '#00ffff';
    const size = isDir ? 8 : 4;

    const group = new THREE.Group();

    // Core Sphere (Using Basic Material for guaranteed visibility)
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(size, 16, 16),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        })
    );
    group.add(sphere);

    // Glowing halo
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.5, 12, 12),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending
        })
    );
    group.add(glow);

    pulseObjects.push({ sphere, glow, t: Math.random() * 10, speed: 0.02 + Math.random() * 0.02 });
    return group;
});

// Global Animation Loop
function globalAnimate() {
    pulseObjects.forEach(obj => {
        obj.t += obj.speed;
        const s = 1 + Math.sin(obj.t) * 0.12;
        obj.sphere.scale.set(s, s, s);
        obj.glow.scale.set(s, s, s);
    });
    requestAnimationFrame(globalAnimate);
}
globalAnimate();

// 4. Send Ready signal
console.log('WebView: Sending ready handshake...');
vscode.postMessage({ command: 'ready' });

window.addEventListener('resize', () => {
    Graph.width(window.innerWidth).height(window.innerHeight);
});
