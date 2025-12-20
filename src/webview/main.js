const vscode = acquireVsCodeApi();
const elem = document.getElementById('graph');
const status = document.getElementById('status');

console.log('WebView: Neo-Synapse Interactive');

let highlightLinks = new Set();

const pulseObjects = [];
const Graph = ForceGraph3D()(elem)
    .backgroundColor('#000308')
    .nodeAutoColorBy('type')
    .nodeLabel(node => `<div class="node-label">${node.name}</div>`)
    // Constant width (2.5). Force no transparency and full opacity.
    .linkColor(link => highlightLinks.has(link) ? '#ffff00' : '#ffffff')
    .linkWidth(2.5)
    .linkTransparent(false)
    .linkOpacity(1.0)
    .linkCurvature(0.15)
    // Particles (Signals) purely constant at 1 as requested
    .linkDirectionalParticles(1)
    .linkDirectionalParticleSpeed(0.005)
    .linkDirectionalParticleWidth(2.5)
    // Radial Tree Mode
    .dagMode('radialout')
    .dagLevelDistance(250)
    .onNodeClick(node => {
        try {
            // 1. Highlight Logic
            highlightLinks.clear();
            if (node) {
                const { links } = Graph.graphData();
                links.forEach(l => {
                    const s = l.source.id || l.source;
                    const t = l.target.id || l.target;
                    if (s === node.id || t === node.id) {
                        highlightLinks.add(l);
                    }
                });
            }

            // Safe refresh trigger
            Graph.linkColor(Graph.linkColor());

            // 2. Open File logic
            if (node && node.type === 'file' && node.path) {
                console.log('WebView: Opening file', node.path);
                vscode.postMessage({ command: 'openFile', path: node.path });
            }
        } catch (err) {
            console.error('WebView: Click Error', err);
        }
    })
    .onBackgroundClick(() => {
        highlightLinks.clear();
        Graph.linkColor(Graph.linkColor());
    });

// Neo-Synapse Rendering
Graph.nodeThreeObject(node => {
    const isDir = node.type === 'directory';
    const color = isDir ? '#ff00ff' : '#00ffff';
    const size = isDir ? 10 : 4;

    const group = new THREE.Group();

    // 1. Core Soma
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(size, 24, 24),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.95
        })
    );
    group.add(sphere);

    // 2. Glowing atmospheric halo
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.8, 16, 16),
        new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        })
    );
    group.add(glow);

    pulseObjects.push({
        sphere,
        glow,
        t: Math.random() * 10,
        speed: isDir ? 0.015 : 0.03
    });

    return group;
});

Graph.linkThreeObjectExtend(true);
Graph.linkDirectionalParticleColor(link => highlightLinks.has(link) ? '#ffff00' : '#ffffff');

// Animation Loop
function animate() {
    pulseObjects.forEach(obj => {
        obj.t += obj.speed;
        const s = 1 + Math.sin(obj.t) * 0.15;
        obj.sphere.scale.set(s, s, s);
        obj.glow.scale.set(s, s, s);
    });
    requestAnimationFrame(animate);
}
animate();

window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'setData') {
        status.style.display = 'none';
        if (message.data && message.data.nodes) {
            console.log('WebView: Rendering interactivity update');
            pulseObjects.length = 0;
            Graph.graphData(message.data);
            setTimeout(() => { Graph.zoomToFit(600); }, 500);
        }
    }
});

window.addEventListener('resize', () => {
    Graph.width(window.innerWidth).height(window.innerHeight);
});

console.log('WebView: Ready signal...');
vscode.postMessage({ command: 'ready' });
