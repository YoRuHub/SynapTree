const vscode = acquireVsCodeApi();
console.log('WebView: Script main.js starting...');
const status = document.getElementById('status');
const elem = document.getElementById('graph');

if (typeof THREE === 'undefined') {
    console.error('THREE is not defined');
    status.innerText = 'Error: Three.js failed to load';
} else if (typeof ForceGraph3D === 'undefined') {
    console.error('ForceGraph3D is not defined');
    status.innerText = 'Error: 3d-force-graph failed to load';
} else {
    status.innerText = 'Libraries loaded, creating graph...';
}

const Graph = ForceGraph3D()(elem)
    .nodeAutoColorBy('type')
    .nodeLabel(node => `<div class="node-label">${node.name}</div>`)
    .nodeRelSize(4)
    .linkColor(() => 'rgba(200, 200, 255, 0.15)')
    .linkWidth(0.8)
    .linkCurvature(0.2) // Curved links for organic look
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(d => 0.005 + (Math.random() * 0.005)) // Randomized speed for "firing" feel
    .linkDirectionalParticleWidth(2)
    .backgroundColor('#00050a') // Deep midnight blue for better depth
    .onNodeClick(node => {
        if (node.type === 'file') {
            vscode.postMessage({
                command: 'openFile',
                path: node.path
            });
        }
    });

// Notify extension that we are ready
vscode.postMessage({ command: 'ready' });

// Neo-Synapse Styling with Pulse Animation
Graph.nodeThreeObject(node => {
    const isDir = node.type === 'directory';
    const color = isDir ? '#ff00ff' : '#00ffff';
    const size = isDir ? 7 : 3.5;

    const group = new THREE.Group();

    // Core sphere (The Neuron/Synapse)
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(size, 32, 32),
        new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            emissive: color,
            emissiveIntensity: 1.2,
            shininess: 100
        })
    );
    group.add(sphere);

    // Inner glow core
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(size * 0.4),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })
    );
    group.add(core);

    // Outer aura (Atmospheric glow)
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(size * 2.2),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        })
    );
    group.add(glow);

    // Pulse animation logic
    const pulseSpeed = 0.02 + (Math.random() * 0.02);
    let t = Math.random() * Math.PI * 2;

    // Add custom animation tick
    const animate = () => {
        t += pulseSpeed;
        const scale = 1 + Math.sin(t) * 0.15;
        sphere.scale.set(scale, scale, scale);
        glow.material.opacity = 0.15 + Math.sin(t) * 0.05;
        requestAnimationFrame(animate);
    };
    animate();

    return group;
});

// Particle Flow Styling
Graph.linkThreeObjectExtend(true)
    .linkDirectionalParticleColor(() => '#00ffff') // Electric cyan particles
    .linkDirectionalParticleWidth(2.5);

// Force Simulation Tweaks for "Synapse" Structure
Graph.d3Force('charge').strength(-150);
Graph.d3Force('link').distance(70);
Graph.d3Force('center').strength(0.1);

window.addEventListener('message', event => {
    const message = event.data;
    console.log('WebView received message:', message.command);
    switch (message.command) {
        case 'setData':
            status.style.display = 'none';
            Graph.graphData(message.data);
            break;
    }
});

// Resize handler
window.addEventListener('resize', () => {
    Graph.width(window.innerWidth);
    Graph.height(window.innerHeight);
});

// Initial camera position
Graph.cameraPosition({ z: 300 });
