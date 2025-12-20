const vscode = acquireVsCodeApi();
const elem = document.getElementById('graph');
const status = document.getElementById('status');

console.log('WebView: SynapTree Initialization Starting');

// 1. Initial Library Check
if (typeof ForceGraph3D !== 'function') {
    const errorMsg = 'Error: 3d-force-graph library failed to load. Check internet connection or CSP settings.';
    status.innerText = errorMsg;
    console.error(errorMsg);
}

let highlightLinks = new Set();
const pulseObjects = [];

let Graph;
try {
    Graph = ForceGraph3D()(elem)
        .backgroundColor('#000308')
        .nodeColor(node => node.color || '#00ffff')
        .nodeLabel(node => `<div class="node-label">${node.name}</div>`)
        .linkColor(link => highlightLinks.has(link) ? '#ffff00' : '#ffffff')
        .linkWidth(2.5)
        .linkTransparent(false)
        .linkOpacity(1.0)
        .linkCurvature(0.15)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.005)
        .linkDirectionalParticleWidth(2.5)
        .dagMode('radialout')
        .dagLevelDistance(250)
        .onNodeClick(node => {
            try {
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
                Graph.linkColor(Graph.linkColor());

                if (node && node.type === 'file' && node.path) {
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

    // Neo-Synapse Aesthetic
    Graph.nodeThreeObject(node => {
        const isDir = node.type === 'directory';
        const nodeColor = node.color || (isDir ? '#ff00ff' : '#00ffff');
        const size = isDir ? 10 : 4;

        const group = new THREE.Group();
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(size, 24, 24),
            new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: 0.95 })
        );
        group.add(sphere);

        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(size * 1.8, 16, 16),
            new THREE.MeshBasicMaterial({
                color: nodeColor,
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

} catch (err) {
    status.innerText = 'Error initializing 3D Graph: ' + err.message;
    console.error('WebView: Graph Init Error', err);
}

// 2. Messaging
window.addEventListener('message', event => {
    const message = event.data;
    try {
        if (message.command === 'setData') {
            console.log('WebView: Received data, nodes:', message.data?.nodes?.length);
            status.style.display = 'none';
            if (message.data && message.data.nodes) {
                pulseObjects.length = 0;
                Graph.graphData(message.data);
                setTimeout(() => { Graph.zoomToFit(600); }, 500);
            }
        }
    } catch (err) {
        console.error('WebView: Message processing error', err);
    }
});

window.addEventListener('resize', () => {
    if (Graph) Graph.width(window.innerWidth).height(window.innerHeight);
});

console.log('WebView: Ready signal sent');
vscode.postMessage({ command: 'ready' });
