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
        .linkColor(link => highlightLinks.has(link) ? 'rgba(255, 255, 0, 0.4)' : 'rgba(255, 255, 255, 0.12)')
        .linkWidth(1.5)
        .linkOpacity(1.0)
        .linkCurvature(0.2)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleWidth(2.0)
        .dagMode('radialout')
        .dagLevelDistance(250)
        .onNodeClick(node => {
            try {
                highlightLinks.clear();
                if (node) {
                    const { links } = Graph.graphData();

                    // Recursive highlight to the "tips" (subtree)
                    const traverse = (n) => {
                        links.forEach(l => {
                            const s = l.source.id || l.source;
                            if (s === n.id) {
                                highlightLinks.add(l);
                                traverse(l.target);
                            }
                        });
                    };
                    traverse(node);
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

        // 1. Core crystalline geometry
        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(size, 1),
            new THREE.MeshPhongMaterial({
                color: nodeColor,
                emissive: nodeColor,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.9,
                shininess: 100
            })
        );
        group.add(core);

        // 2. Inner glow shell
        const innerGlow = new THREE.Mesh(
            new THREE.IcosahedronGeometry(size * 1.4, 1),
            new THREE.MeshBasicMaterial({
                color: nodeColor,
                transparent: true,
                opacity: 0.2,
                blending: THREE.AdditiveBlending
            })
        );
        group.add(innerGlow);

        // 3. Outer phantasmal aura
        const aura = new THREE.Mesh(
            new THREE.SphereGeometry(size * 2.2, 16, 16),
            new THREE.MeshBasicMaterial({
                color: nodeColor,
                transparent: true,
                opacity: 0.08,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide
            })
        );
        group.add(aura);

        pulseObjects.push({
            nodeId: node.id,
            node: node,
            core,
            innerGlow,
            aura,
            t: Math.random() * 10,
            speed: isDir ? 0.015 : 0.03,
            isMatch: false
        });

        return group;
    });

    Graph.linkThreeObjectExtend(true);
    Graph.linkDirectionalParticleColor(link => highlightLinks.has(link) ? 'rgba(255, 255, 0, 0.6)' : '#ffffff');

    function animate() {
        pulseObjects.forEach(obj => {
            obj.t += obj.speed;

            if (obj.isMatch) {
                // High-freq radiance for matches
                const s = 1.3 + Math.sin(obj.t * 3) * 0.35;
                obj.core.scale.set(s, s, s);
                obj.innerGlow.scale.set(s * 1.5, s * 1.5, s * 1.5);
                obj.aura.scale.set(s * 2.5, s * 2.5, s * 2.5);

                obj.innerGlow.material.opacity = 0.5;
                obj.aura.material.opacity = 0.3;
                obj.innerGlow.material.color.set('#ffff00');
                obj.aura.material.color.set('#ffffcc');
            } else {
                // Standard organic pulse
                const s = 1 + Math.sin(obj.t) * 0.12;
                obj.core.scale.set(s, s, s);
                obj.innerGlow.scale.set(s, s, s);
                obj.aura.scale.set(s, s, s);

                obj.innerGlow.material.opacity = 0.15;
                obj.aura.material.opacity = 0.06;
                const nodeColor = obj.node.color || (obj.node.type === 'directory' ? '#ff00ff' : '#00ffff');
                obj.innerGlow.material.color.set(nodeColor);
                obj.aura.material.color.set(nodeColor);
            }
        });
        requestAnimationFrame(animate);
    }
    animate();
    log('Animation loop started');

    // Real-time search handling
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            if (!query) {
                status.style.display = 'none';
                pulseObjects.forEach(obj => {
                    obj.isMatch = false;
                });
                return;
            }

            const { nodes } = Graph.graphData();
            let matchCount = 0;

            pulseObjects.forEach(obj => {
                const node = nodes.find(n => n.id === obj.nodeId || n === obj.node);
                if (node && node.name.toLowerCase().includes(query)) {
                    obj.isMatch = true;
                    matchCount++;
                } else {
                    obj.isMatch = false;
                }
            });

            if (matchCount > 0) {
                status.innerText = `${matchCount} matches found`;
                status.style.display = 'block';
                status.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
            } else {
                status.innerText = 'No matches found';
                status.style.display = 'block';
                status.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            }
        });
    }

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
                status.style.display = 'block';
                status.innerText = `${message.data.nodes.length} nodes loaded`;
                setTimeout(() => {
                    status.style.display = 'none';
                    Graph.zoomToFit(600);
                }, 1500);
                log('Data applied successfully');
            } else {
                log('Received empty or invalid data');
                status.innerText = 'Error: No nodes found in workspace';
            }
        } catch (err) {
            log('setData Error: ' + err.message);
            status.innerText = 'Error processing data: ' + err.message;
        }
    } else if (message.command === 'search') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
});

window.addEventListener('resize', () => {
    if (Graph) Graph.width(window.innerWidth).height(window.innerHeight);
});

log('Sending ready signal');
vscode.postMessage({ command: 'ready' });
