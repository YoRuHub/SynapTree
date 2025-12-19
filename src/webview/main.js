const vscode = acquireVsCodeApi();
console.log('WebView: Script main.js starting...');
const status = document.getElementById('status');
const elem = document.getElementById('graph');

if (typeof THREE === 'undefined') {
    console.error('THREE is not defined');
    status.innerText = 'Error: Three.js failed to load (Check internet connection or CSP)';
} else if (typeof ForceGraph3D === 'undefined') {
    console.error('ForceGraph3D is not defined');
    status.innerText = 'Error: 3d-force-graph failed to load';
} else {
    status.innerText = 'Libraries loaded, creating graph...';
}

const Graph = ForceGraph3D()(elem)
    .nodeAutoColorBy('type')
    .nodeLabel(node => `<div class="node-label">${node.name} (${node.type})</div>`)
    .nodeRelSize(4)
    .linkColor(() => 'rgba(200, 200, 255, 0.2)')
    .linkWidth(1)
    .linkCurvature(0.25)
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(d => Math.random() * 0.01 + 0.002)
    .linkDirectionalParticleWidth(2)
    .backgroundColor('#000508')
    .onNodeClick(node => {
        if (node.type === 'file') {
            vscode.postMessage({ command: 'openFile', path: node.path });
        }
    });

// Neo-Synapse Styling with Three.js Spheres
Graph.nodeThreeObject(node => {
    const isDir = node.type === 'directory';
    const color = isDir ? '#ff00ff' : '#00ffff';
    const size = isDir ? 8 : 4;

    const group = new THREE.Group();

    // 1. Core Sphere (The "Soma" or terminal)
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(size, 20, 20),
        new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            emissive: color,
            emissiveIntensity: 1.5,
            shininess: 100
        })
    );
    group.add(sphere);

    // 2. Halo Glow
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.6, 16, 16),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        })
    );
    group.add(glow);

    // 3. Pulse Logic
    const speed = 0.02 + Math.random() * 0.03;
    let t = Math.random() * 100;
    const animate = () => {
        t += speed;
        const scale = 1 + Math.sin(t) * 0.12;
        sphere.scale.set(scale, scale, scale);
        glow.scale.set(scale, scale, scale);
        requestAnimationFrame(animate);
    };
    animate();

    return group;
});

Graph.linkThreeObjectExtend(true)
    .linkDirectionalParticleColor(() => '#ffffff')
    .linkDirectionalParticleWidth(3);

// Forces
Graph.d3Force('charge').strength(-180);
Graph.d3Force('link').distance(80);

// Handshake
console.log('WebView: Sending ready...');
vscode.postMessage({ command: 'ready' });

window.addEventListener('message', event => {
    const message = event.data;
    console.log('WebView: Received', message.command);
    if (message.command === 'setData') {
        status.style.display = 'none';
        Graph.graphData(message.data);
    }
});

window.addEventListener('resize', () => {
    Graph.width(window.innerWidth).height(window.innerHeight);
});
