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
window.showLabels = true; // Default to showing labels
let Graph;

try {
    Graph = ForceGraph3D()(elem)
        .backgroundColor('#000308')
        .nodeColor(node => node.color || '#00ffff')
        // .nodeLabel removed - using custom TextSprite in nodeThreeObject
        .linkColor(link => highlightLinks.has(link) ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.25)')
        .linkWidth(1.5)
        .linkOpacity(1.0)
        .linkCurvature(0.2)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleWidth(2.0)
        // .dagMode('radialout')  <-- Disabled to allow manual node movement (root included)
        // .dagLevelDistance(250) <-- Disabled
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
            // Call hideSearch handled in global scope but also here for safety
            const searchContainer = document.getElementById('search-container');
            const searchInput = document.getElementById('search-input');
            if (searchContainer) searchContainer.classList.remove('visible');
            if (searchInput) searchInput.value = '';
            pulseObjects.forEach(obj => { obj.isMatch = false; });
            status.style.display = 'none';
        });

    // Caches for performance
    const geometryCache = {
        coreDir: new THREE.IcosahedronGeometry(10, 1),
        coreFile: new THREE.IcosahedronGeometry(4, 1),
        innerGlowDir: new THREE.IcosahedronGeometry(14, 1),
        innerGlowFile: new THREE.IcosahedronGeometry(5.6, 1),
        auraDir: new THREE.SphereGeometry(22, 16, 16),
        auraFile: new THREE.SphereGeometry(8.8, 16, 16)
    };

    const materialCache = new Map();

    function getCachedMaterial(color, type) {
        const key = `${color}-${type}`;
        if (!materialCache.has(key)) {
            let mat;
            if (type === 'core') {
                mat = new THREE.MeshPhongMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.9,
                    shininess: 100
                });
            } else if (type === 'inner') {
                mat = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.2,
                    blending: THREE.AdditiveBlending
                });
            } else if (type === 'aura') {
                mat = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.08,
                    blending: THREE.AdditiveBlending,
                    side: THREE.BackSide
                });
            }
            materialCache.set(key, mat);
        }
        return materialCache.get(key);
    }

    function createTextSprite(text) {
        const canvas = document.createElement('canvas');
        const fontSize = 64; // Increased resolution
        const padding = 20;
        const font = `Bold ${fontSize}px Arial, sans-serif`;

        const context = canvas.getContext('2d');
        context.font = font;

        // Calculate text width
        const metrics = context.measureText(text);
        const textWidth = metrics.width;

        // Resize canvas to fit text
        canvas.width = textWidth + padding * 2;
        canvas.height = fontSize + padding * 2;

        // Re-apply font after resize
        context.font = font;
        context.fillStyle = 'rgba(255, 255, 255, 1.0)';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Shadow/Glow for readability
        context.shadowColor = 'rgba(0,0,0,1.0)';
        context.shadowBlur = 6;
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;

        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false, // Ensure label is always seen on top of local aura
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);

        // Render order high to appear on top of transparent auras
        sprite.renderOrder = 999;

        // Scale sprite based on aspect ratio
        const scaleFactor = 0.5;
        sprite.scale.set(canvas.width / fontSize * 10 * scaleFactor, canvas.height / fontSize * 10 * scaleFactor, 1);

        return sprite;
    }

    Graph.nodeThreeObject(node => {
        const isDir = node.type === 'directory';
        const nodeColor = node.color || (isDir ? '#ff00ff' : '#00ffff');

        const group = new THREE.Group();

        // 1. Core crystalline geometry
        const core = new THREE.Mesh(
            isDir ? geometryCache.coreDir : geometryCache.coreFile,
            getCachedMaterial(nodeColor, 'core').clone()
        );
        group.add(core);

        // 2. Inner glow shell
        const innerGlow = new THREE.Mesh(
            isDir ? geometryCache.innerGlowDir : geometryCache.innerGlowFile,
            getCachedMaterial(nodeColor, 'inner').clone()
        );
        group.add(innerGlow);

        // 3. Outer phantasmal aura
        const aura = new THREE.Mesh(
            isDir ? geometryCache.auraDir : geometryCache.auraFile,
            getCachedMaterial(nodeColor, 'aura').clone()
        );
        group.add(aura);

        // 4. Permanent Label (Sprite)
        const labelSprite = createTextSprite(node.name);
        // Position below the aura. Aura radius is ~22 for dirs, ~9 for files.
        const yOffset = isDir ? -35 : -18;
        labelSprite.position.y = yOffset;

        // Ensure initial visibility logic respects window.showLabels
        labelSprite.visible = (window.showLabels !== false);
        group.add(labelSprite);

        pulseObjects.push({
            nodeId: node.id,
            node: node,
            core,
            innerGlow,
            aura,
            labelSprite, // Track for toggling
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
                // Stable radiance - no jarring scale change
                const s = 1.6; // Keep constant size for matches
                obj.core.scale.set(s, s, s);
                obj.innerGlow.scale.set(s * 1.5, s * 1.5, s * 1.5);
                obj.aura.scale.set(s * 2.5, s * 2.5, s * 2.5);

                // Subtle high-freq flicker (opacity only)
                const flicker = 0.4 + Math.sin(obj.t * 4) * 0.15;
                obj.innerGlow.material.opacity = flicker;
                obj.aura.material.opacity = flicker * 0.5;
                obj.innerGlow.material.color.set('#ffff00');
                obj.aura.material.color.set('#ffffcc');
            } else {
                // Standard organic pulse (subtle)
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
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchClose = document.getElementById('search-close');

    function hideSearch() {
        if (searchContainer) searchContainer.classList.remove('visible');
        if (searchInput) searchInput.value = '';
        pulseObjects.forEach(obj => { obj.isMatch = false; });
        status.style.display = 'none';
        log('Search hidden');
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            if (!query) {
                status.style.display = 'none';
                pulseObjects.forEach(obj => { obj.isMatch = false; });
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

    if (searchClose) {
        searchClose.addEventListener('click', hideSearch);
    }

    // Auto-hide search when background is clicked
    Graph.onBackgroundClick(() => {
        highlightLinks.clear();
        Graph.linkColor(Graph.linkColor());
        hideSearch();
    });

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
                    // Use a closer camera position instead of fitting everything (which can be too far)
                    Graph.cameraPosition({ z: 400 }, null, 1200);
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
        const searchContainer = document.getElementById('search-container');
        if (searchContainer) {
            if (searchContainer.classList.contains('visible')) {
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            } else {
                searchContainer.classList.add('visible');
                setTimeout(() => {
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) searchInput.focus();
                }, 300);
            }
        }
    } else if (message.command === 'toggleLabels') {
        const showLabels = !window.showLabels;
        window.showLabels = showLabels;

        // Toggle visibility of existing sprite labels
        pulseObjects.forEach(obj => {
            if (obj.labelSprite) {
                obj.labelSprite.visible = showLabels;
            }
        });

        status.style.display = 'block';
        status.innerText = showLabels ? 'Labels: ON' : 'Labels: OFF';
        status.style.opacity = '1';
        setTimeout(() => {
            status.style.opacity = '0';
        }, 1500);
    }
});

window.addEventListener('resize', () => {
    if (Graph) Graph.width(window.innerWidth).height(window.innerHeight);
});

log('Sending ready signal');
vscode.postMessage({ command: 'ready' });
