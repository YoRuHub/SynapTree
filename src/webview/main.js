const vscode = acquireVsCodeApi();
const elem = document.getElementById('graph');
const status = document.getElementById('status');

function log(msg) {
    console.log('WebView:', msg);
    vscode.postMessage({ command: 'log', text: msg });
}

log('Script started');

// 1. Initial Library Check
if (typeof ForceGraph3D !== 'function') {
    const errorMsg = 'Error: 3d-force-graph library not found. Check connection/CSP.';
    status.innerText = errorMsg;
    log(errorMsg);
} else {
    log('3d-force-graph library detected');
}

let highlightLinks = new Set();
const pulseObjects = [];
let Graph;

try {
    Graph = ForceGraph3D()(elem)
        .backgroundColor('#000308')
        .nodeColor(node => node.color || '#00ffff')
        .nodeLabel(node => `<div class="node-label">${node.name}</div>`)
        // Standardizing width at 2.5. Restore transparency for biological feel.
        .linkColor(link => highlightLinks.has(link) ? '#ffff00' : 'rgba(255, 255, 255, 0.2)')
        .linkWidth(2.5)
        .linkOpacity(1.0) // This controls linkOpacity property if linkTransparent is true
        .linkCurvature(0.15)
        // Particles (Signals) MUST be visible
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.005)
        .linkDirectionalParticleWidth(3.0)
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
                log('Click Error: ' + err.message);
            }
        })
        .onBackgroundClick(() => {
            highlightLinks.clear();
            Graph.linkColor(Graph.linkColor());
        });

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
    log('Animation loop started');

} catch (err) {
    status.innerText = 'Graph Init Error: ' + err.message;
    log('Graph Init Error: ' + err.stack);
}

// Global error catcher
window.onerror = function (msg, url, line) {
    log(`Runtime Error: ${msg} at ${url}:${line}`);
};

window.addEventListener('message', event => {
    const message = event.data;
    log('Received message: ' + (message ? message.command : 'undefined'));
    if (message.command === 'setData') {
        try {
            if (message.data && message.data.nodes) {
                log(`Processing data: ${message.data.nodes.length} nodes`);
                status.innerText = 'Rendering Graph...';
                pulseObjects.length = 0;
                Graph.graphData(message.data);
                status.style.display = 'none';
                setTimeout(() => { Graph.zoomToFit(600); }, 500);
                log('Data applied successfully');
            } else {
                log('Received empty or invalid data');
                status.innerText = 'Error: No nodes found in workspace';
            }
        } catch (err) {
            log('setData Error: ' + err.message);
            status.innerText = 'Error processing data: ' + err.message;
        }
    }
});

window.addEventListener('resize', () => {
    if (Graph) Graph.width(window.innerWidth).height(window.innerHeight);
});

log('Sending ready signal');
vscode.postMessage({ command: 'ready' });
