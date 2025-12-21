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
        coreFile: new THREE.IcosahedronGeometry(4, 0), // Optimized: Low Poly (20 tris)
        innerGlowDir: new THREE.IcosahedronGeometry(14, 1),
        innerGlowFile: new THREE.IcosahedronGeometry(5.6, 0), // Optimized: Low Poly
        auraDir: new THREE.SphereGeometry(22, 16, 16),
        auraFile: new THREE.IcosahedronGeometry(10, 0) // Optimized: Replaced Sphere with Low Poly
    };

    const materialCache = new Map();

    function getCachedMaterial(color, type) {
        const key = `${color}-${type}`;
        if (!materialCache.has(key)) {
            let mat;
            if (type === 'core') {
                // High-quality Cell-like Material (Glass/Jelly)
                mat = new THREE.MeshPhysicalMaterial({
                    color: color,
                    metalness: 0.1,
                    roughness: 0.15,
                    transmission: 0.6, // Glass-like transparency
                    thickness: 2.0, // Refraction volume
                    clearcoat: 1.0, // Wet surface
                    clearcoatRoughness: 0.1,
                    transparent: true,
                    opacity: 1.0 // Transmission handles visibility
                });
            } else if (type === 'inner') {
                // Soft inner glow (Nucleus)
                mat = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.35, // Slightly more visible
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

    // Generic Ripple Texture (Cached)
    const rippleTexture = (() => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Enable high-quality glow
        ctx.shadowColor = '#ffd700'; // Gold glow
        ctx.shadowBlur = 10;

        // Ring 1: Main sharp ring
        ctx.beginPath();
        ctx.arc(cx, cy, 100, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Ring 2: Subtle secondary ring (inner)
        ctx.beginPath();
        ctx.arc(cx, cy, 85, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Ring 3: Subtle secondary ring (outer)
        ctx.beginPath();
        ctx.arc(cx, cy, 115, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.lineWidth = 3;
        ctx.stroke();

        return new THREE.CanvasTexture(canvas);
    })();

    function createRippleSprite() {
        // Reuse the texture, create new material for independent opacity control
        const material = new THREE.SpriteMaterial({
            map: rippleTexture,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });
        return new THREE.Sprite(material);
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

        // 5. Ripple Sprite (initially hidden)
        const ripple = createRippleSprite();
        ripple.visible = false;
        ripple.scale.set(0, 0, 0); // Start small
        group.add(ripple);

        pulseObjects.push({
            nodeId: node.id,
            node: node,
            core,
            innerGlow,
            aura,
            labelSprite, // Track for toggling
            ripple, // Track ripple
            t: Math.random() * 10,
            speed: isDir ? 0.015 : 0.03,
            isMatch: false,
            baseScale: isDir ? 25 : 10 // Base size for ripple scaling
        });

        return group;
    });

    Graph.linkThreeObjectExtend(true);
    Graph.linkDirectionalParticleColor(link => highlightLinks.has(link) ? 'rgba(255, 255, 0, 0.6)' : '#ffffff');

    function animate() {
        pulseObjects.forEach(obj => {
            obj.t += obj.speed;

            if (obj.isMatch) {
                // Highlight Core
                obj.core.scale.set(1.5, 1.5, 1.5);
                obj.innerGlow.material.color.set('#ffd700');
                obj.innerGlow.material.opacity = 0.5;

                // Hide texture aura to reduce noise, focus on ripple
                obj.aura.visible = false;

                // Ripple Animation (White Line)
                obj.ripple.visible = true;
                const rippleSpeed = 1.0;
                const cycle = (obj.t * rippleSpeed) % 1;

                // Expand from base size to 4x
                const s = obj.baseScale * (1 + cycle * 3);
                obj.ripple.scale.set(s, s, 1);

                // Fade out
                obj.ripple.material.opacity = 1.0 * (1 - Math.pow(cycle, 3));

            } else {
                // Standard organic pulse (subtle)
                const s = 1 + Math.sin(obj.t) * 0.12;
                obj.core.scale.set(s, s, s);
                obj.innerGlow.scale.set(s, s, s);
                obj.aura.scale.set(s, s, s);

                // Reset visibility and colors
                obj.aura.visible = true;
                obj.ripple.visible = false;

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
    const searchPrev = document.getElementById('search-prev');
    const searchNext = document.getElementById('search-next');
    const searchCount = document.getElementById('search-results-count');

    let matchedNodes = [];
    let currentMatchIndex = -1;

    function hideSearch() {
        if (searchContainer) searchContainer.classList.remove('visible');
        if (searchInput) searchInput.value = '';
        pulseObjects.forEach(obj => { obj.isMatch = false; });
        status.style.display = 'none';
        matchedNodes = [];
        currentMatchIndex = -1;
        if (searchCount) searchCount.innerText = '';
        log('Search hidden');
    }

    function focusOnNode(node) {
        if (!node) return;

        // Aim at the node from a distance
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        const newPos = node.x || node.y || node.z
            ? { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
            : { x: 0, y: 0, z: distance }; // Fallback for specific 0,0,0 cases

        Graph.cameraPosition(
            newPos, // new position
            node,   // lookAt ({ x, y, z })
            1500    // ms transition duration
        );
    }

    function updateNavState() {
        if (matchedNodes.length > 0) {
            searchCount.innerText = `${currentMatchIndex + 1} / ${matchedNodes.length}`;
            if (searchPrev) searchPrev.style.display = 'flex';
            if (searchNext) searchNext.style.display = 'flex';
        } else {
            searchCount.innerText = '';
            if (searchPrev) searchPrev.style.display = 'none';
            if (searchNext) searchNext.style.display = 'none';
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            matchedNodes = [];
            currentMatchIndex = -1;

            if (!query) {
                status.style.display = 'none';
                pulseObjects.forEach(obj => { obj.isMatch = false; });
                updateNavState();
                return;
            }

            const { nodes } = Graph.graphData();

            pulseObjects.forEach(obj => {
                const node = nodes.find(n => n.id === obj.nodeId || n === obj.node);
                if (node && node.name.toLowerCase().includes(query)) {
                    obj.isMatch = true;
                    matchedNodes.push(node);
                } else {
                    obj.isMatch = false;
                }
            });

            if (matchedNodes.length > 0) {
                status.innerText = `${matchedNodes.length} matches found`;
                status.style.display = 'block';
                status.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';

                // Auto-select first match
                currentMatchIndex = 0;
                focusOnNode(matchedNodes[0]);
            } else {
                status.innerText = 'No matches found';
                status.style.display = 'block';
                status.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            }
            updateNavState();
        });
    }

    if (searchPrev) {
        searchPrev.addEventListener('click', () => {
            if (matchedNodes.length === 0) return;
            currentMatchIndex = (currentMatchIndex - 1 + matchedNodes.length) % matchedNodes.length;
            focusOnNode(matchedNodes[currentMatchIndex]);
            updateNavState();
        });
    }

    if (searchNext) {
        searchNext.addEventListener('click', () => {
            if (matchedNodes.length === 0) return;
            currentMatchIndex = (currentMatchIndex + 1) % matchedNodes.length;
            focusOnNode(matchedNodes[currentMatchIndex]);
            updateNavState();
        });
    }

    // Auto-hide search when background is clicked
    Graph.onBackgroundClick(() => {
        highlightLinks.clear();
        Graph.linkColor(Graph.linkColor());
        // hideSearch(); // User might want to keep search open while clicking around? 
        // Let's keep hideSearch on background click for now, as per original behavior.
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
