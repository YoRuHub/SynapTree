const vscode = acquireVsCodeApi();
const elem = document.getElementById('graph');
const status = document.getElementById('status');

function log(msg) {
    console.log('WebView:', msg);
    vscode.postMessage({ command: 'log', text: msg });
}

log('Script started');

if (typeof ForceGraph3D !== 'function') {
    const errorMsg = 'Error: 3d-force-graph library not found. Check connection/CSP.';
    status.innerText = errorMsg;
    log(errorMsg);
} else {
    log('3d-force-graph library detected');
}

// --- CONFIGURATION CENTRAL ---
const GIT_STATUS_CONFIG = {
    modified: {
        color: '#ffaa00', // Orange (VS Code Modified)
        opacityGlow: 0.4,
        opacityAura: 0.2
    },
    untracked: {
        color: '#73c991', // Light Green (VS Code Untracked)
        opacityGlow: 0.4,
        opacityAura: 0.2
    },
    staged: {
        color: '#55ff55', // Bright Green (Staged)
        opacityGlow: 0.4,
        opacityAura: 0.2
    },
    default: {
        color: '#ffffff', // Fallback
        opacityGlow: 0.15,
        opacityAura: 0.06
    }
};

let highlightLinks = new Set();
const pulseObjects = [];
window.showLabels = true;
let Graph;

// Queue to hold Git Status updates arriving before Graph is ready
const pendingUpdates = new Map();

try {
    Graph = ForceGraph3D()(elem)
        .backgroundColor('#000308')
        .nodeColor(node => node.color || '#00ffff')
        .linkColor(link => highlightLinks.has(link) ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.25)')
        .linkWidth(1.5)
        .linkOpacity(1.0)
        .linkCurvature(0.2)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleWidth(2.0)
        .onNodeClick(node => {
            try {
                highlightLinks.clear();
                if (node) {
                    const { links } = Graph.graphData();
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

            const searchContainer = document.getElementById('search-container');
            const searchInput = document.getElementById('search-input');
            if (searchContainer) searchContainer.classList.remove('visible');
            if (searchInput) searchInput.value = '';
            pulseObjects.forEach(obj => { obj.isMatch = false; });
            status.style.display = 'none';
        });

    const geometryCache = {
        coreDir: new THREE.IcosahedronGeometry(10, 1),
        coreFile: new THREE.IcosahedronGeometry(4, 0),
        innerGlowDir: new THREE.IcosahedronGeometry(14, 1),
        innerGlowFile: new THREE.IcosahedronGeometry(5.6, 0),
        auraDir: new THREE.SphereGeometry(22, 16, 16),
        auraFile: new THREE.IcosahedronGeometry(10, 0)
    };

    const materialCache = new Map();

    function getCachedMaterial(color, type) {
        const key = `${color}-${type}`;
        if (!materialCache.has(key)) {
            let mat;
            if (type === 'core') {
                mat = new THREE.MeshPhysicalMaterial({
                    color: color,
                    metalness: 0.1,
                    roughness: 0.15,
                    transmission: 0.6,
                    thickness: 2.0,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    transparent: true,
                    opacity: 1.0
                });
            } else if (type === 'inner') {
                mat = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.35,
                    blending: THREE.AdditiveBlending
                });
            } else if (type === 'aura') {
                mat = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.08,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide
                });
            }
            materialCache.set(key, mat);
        }
        return materialCache.get(key);
    }

    function createTextSprite(text) {
        const canvas = document.createElement('canvas');
        const fontSize = 64;
        const padding = 20;
        const font = `Bold ${fontSize}px Arial, sans-serif`;

        const context = canvas.getContext('2d');
        context.font = font;
        const metrics = context.measureText(text);
        const textWidth = metrics.width;

        canvas.width = textWidth + padding * 2;
        canvas.height = fontSize + padding * 2;

        context.font = font;
        context.fillStyle = 'rgba(255, 255, 255, 1.0)';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = 'rgba(0,0,0,1.0)';
        context.shadowBlur = 6;
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;

        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.renderOrder = 999;
        const scaleFactor = 0.5;
        sprite.scale.set(canvas.width / fontSize * 10 * scaleFactor, canvas.height / fontSize * 10 * scaleFactor, 1);
        return sprite;
    }

    const rippleTexture = (() => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, 100, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 85, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 115, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 3;
        ctx.stroke();
        return new THREE.CanvasTexture(canvas);
    })();

    function createRippleSprite() {
        const material = new THREE.SpriteMaterial({
            map: rippleTexture,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });
        return new THREE.Sprite(material);
    }

    // --- NODE CREATION ---
    Graph.nodeThreeObject(node => {
        const isDir = node.type === 'directory';

        // Base Color: Determined by file type or default
        const baseColor = node.color || (isDir ? '#0088ff' : '#aaaaaa');

        // Defaults
        // User requested "Glass-like faint white blur" for the outermost layer
        let auraColor = '#ffffff'; // Default to White for correct material caching
        let innerColor = baseColor;

        let opacityGlow = GIT_STATUS_CONFIG.default.opacityGlow;
        let opacityAura = 0.00; // Completely transparent default
        let emissiveInt = 0.5;

        // Apply Configuration from central object (Overrides defaults if status exists)
        if (node.gitStatus && GIT_STATUS_CONFIG[node.gitStatus]) {
            const conf = GIT_STATUS_CONFIG[node.gitStatus];
            auraColor = conf.color;
            // innerColor remains baseColor (User Request: Only outer aura changes)
            opacityGlow = conf.opacityGlow;
            opacityAura = conf.opacityAura;
            emissiveInt = 1.0;
        }

        const group = new THREE.Group();

        // 1. Core
        const coreMat = getCachedMaterial(baseColor, 'core').clone();
        coreMat.emissive.set(baseColor);
        coreMat.emissiveIntensity = emissiveInt;

        const core = new THREE.Mesh(
            isDir ? geometryCache.coreDir : geometryCache.coreFile,
            coreMat
        );
        group.add(core);

        // 2. Inner Glow
        const glowMat = getCachedMaterial(innerColor, 'inner').clone();
        glowMat.opacity = opacityGlow;
        const innerGlow = new THREE.Mesh(
            isDir ? geometryCache.innerGlowDir : geometryCache.innerGlowFile,
            glowMat
        );
        group.add(innerGlow);
        innerGlow.visible = true;

        // 3. Outer Aura
        const auraMat = getCachedMaterial(auraColor, 'aura').clone();
        auraMat.opacity = opacityAura;
        const aura = new THREE.Mesh(
            isDir ? geometryCache.auraDir : geometryCache.auraFile,
            auraMat
        );
        // Ensure DoubleSide is picked up by getCachedMaterial ('aura')
        group.add(aura);
        aura.visible = true;

        // 4. Label
        const labelSprite = createTextSprite(node.name);
        const yOffset = isDir ? -35 : -18;
        labelSprite.position.y = yOffset;
        labelSprite.material.color.set(node.gitStatus ? auraColor : '#ffffff');
        labelSprite.visible = (window.showLabels !== false);
        group.add(labelSprite);

        // 5. Ripple
        const ripple = createRippleSprite();
        ripple.visible = false;
        ripple.scale.set(0, 0, 0);
        group.add(ripple);

        pulseObjects.push({
            nodeId: node.id,
            node: node,
            core,
            innerGlow,
            aura,
            labelSprite,
            ripple,
            t: Math.random() * 10,
            speed: isDir ? 0.015 : 0.03,
            isMatch: false,
            baseScale: isDir ? 25 : 10,
            baseColor: baseColor
        });

        return group;
    });

    Graph.linkThreeObjectExtend(true);
    Graph.linkDirectionalParticleColor(link => highlightLinks.has(link) ? 'rgba(255, 255, 0, 0.6)' : '#ffffff');

    function animate() {
        pulseObjects.forEach(obj => {
            obj.t += obj.speed;

            if (obj.isMatch) {
                const flashColor = obj.baseColor;
                obj.core.scale.set(1.5, 1.5, 1.5);
                obj.aura.visible = false;
                obj.innerGlow.visible = false;
                obj.ripple.visible = true;
                obj.ripple.material.color.set(flashColor);
                const rippleSpeed = 1.0;
                const cycle = (obj.t * rippleSpeed) % 1;
                const s = obj.baseScale * (1 + cycle * 3);
                obj.ripple.scale.set(s, s, 1);
                obj.ripple.material.opacity = 1.0 * (1 - Math.pow(cycle, 3));
            } else {
                const s = 1 + Math.sin(obj.t) * 0.12;
                obj.core.scale.set(s, s, s);
                obj.innerGlow.scale.set(s, s, s);
                obj.aura.scale.set(s, s, s);
                obj.aura.visible = true;
                obj.innerGlow.visible = true;
                obj.ripple.visible = false;

                // --- COLOR LOGIC (Loop with Status) ---
                let targetInnerColor = obj.baseColor;
                let targetOuterColor = '#ffffff'; // Default Glassy White
                let targetOpacityGlow = GIT_STATUS_CONFIG.default.opacityGlow;
                let targetOpacityAura = 0.02; // Completely transparent default

                // Use centralized config
                if (obj.node.gitStatus && GIT_STATUS_CONFIG[obj.node.gitStatus]) {
                    const conf = GIT_STATUS_CONFIG[obj.node.gitStatus];
                    // innerColor NOT changed (User Request)
                    targetOuterColor = conf.color;
                    targetOpacityGlow = conf.opacityGlow;
                    targetOpacityAura = conf.opacityAura;
                }

                obj.innerGlow.material.color.set(targetInnerColor);
                obj.aura.material.color.set(targetOuterColor);
                obj.innerGlow.material.opacity = targetOpacityGlow;
                obj.aura.material.opacity = targetOpacityAura;

                if (obj.labelSprite) {
                    obj.labelSprite.material.color.set(obj.node.gitStatus ? targetOuterColor : '#ffffff');
                }
            }
        });
        requestAnimationFrame(animate);
    }
    animate();
    log('Animation loop started');

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
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        const newPos = node.x || node.y || node.z
            ? { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
            : { x: 0, y: 0, z: distance };
        Graph.cameraPosition(newPos, node, 1500);
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

    Graph.onBackgroundClick(() => {
        highlightLinks.clear();
        Graph.linkColor(Graph.linkColor());
        hideSearch();
    });

} catch (err) {
    status.innerText = 'Graph Init Error: ' + err.message;
    log('Graph Init Error: ' + err.stack);
}

window.onerror = function (msg, url, line) {
    log(`Runtime Error: ${msg} at ${url}:${line}`);
};

// --- HELPER to apply status ---
function applyNodeStatus(targetId, newStatus) {
    log(`[Update] Request for: ${targetId} -> ${newStatus}`);

    // Try exact match
    let targetObj = pulseObjects.find(obj => obj.nodeId === targetId);

    // Try fuzzy
    if (!targetObj) {
        const lowerTarget = targetId.toLowerCase();
        targetObj = pulseObjects.find(obj => obj.nodeId.toLowerCase() === lowerTarget);
        if (targetObj) {
            log(`[Update] Fuzzy match found: ${targetObj.nodeId}`);
        }
    }

    if (targetObj) {
        log(`[Update] Applied to node: ${targetObj.node.name}`);
        targetObj.node.gitStatus = newStatus;
        // Animation loop handles colors via GIT_STATUS_CONFIG
    } else {
        log(`[Update] Node NOT FOUND for id: ${targetId}`);
    }
}

window.addEventListener('message', event => {
    const message = event.data;

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
                    Graph.cameraPosition({ z: 400 }, null, 1200);

                    // --- PROCESS QUEUE ---
                    if (pendingUpdates.size > 0) {
                        log(`Processing ${pendingUpdates.size} queued git updates...`);
                        pendingUpdates.forEach((st, id) => {
                            applyNodeStatus(id, st);
                        });
                        pendingUpdates.clear();
                    }
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
    } else if (message.command === 'updateNodeStatus') {
        const targetId = message.id;
        const newStatus = message.gitStatus;

        if (pulseObjects.length === 0) {
            log(`[Update] Graph not ready/empty. Queuing update for: ${targetId}`);
            pendingUpdates.set(targetId, newStatus);
        } else {
            applyNodeStatus(targetId, newStatus);
        }

    } else if (message.command === 'toggleLabels') {
        const showLabels = !window.showLabels;
        window.showLabels = showLabels;
        pulseObjects.forEach(obj => {
            if (obj.labelSprite) {
                obj.labelSprite.visible = showLabels;
            }
        });
        status.style.display = 'block';
        status.innerText = showLabels ? 'Labels: ON' : 'Labels: OFF';
        setTimeout(() => { status.style.display = 'none'; }, 2000);
    }
});

// Notify extension that we are ready to receive data
log('Sending ready signal...');
vscode.postMessage({ command: 'ready' });
