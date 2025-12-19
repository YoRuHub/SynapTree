const vscode = acquireVsCodeApi();
console.log('WebView: main.js script execution started');

window.addEventListener('DOMContentLoaded', () => {
    console.log('WebView: DOMContentLoaded event fired');
    const status = document.getElementById('status');
    const elem = document.getElementById('graph');

    if (!elem) {
        console.error('WebView: Could not find #graph element');
        return;
    }

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

    // Neo-Synapse Styling with Three.js Spheres (Optimized)
    const pulseObjects = [];
    Graph.nodeThreeObject(node => {
        const isDir = node.type === 'directory';
        const color = isDir ? '#ff00ff' : '#00ffff';
        const size = isDir ? 8 : 4;

        const group = new THREE.Group();

        // 1. Core Sphere
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(size, 16, 16),
            new THREE.MeshPhongMaterial({
                color: color,
                transparent: true,
                opacity: 0.9,
                emissive: color,
                emissiveIntensity: 1.2
            })
        );
        group.add(sphere);

        // 2. Halo Glow
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(size * 1.5, 12, 12),
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.1,
                blending: THREE.AdditiveBlending
            })
        );
        group.add(glow);

        // Add to animation list instead of separate RAF
        pulseObjects.push({ sphere, glow, t: Math.random() * 10, speed: 0.02 + Math.random() * 0.02 });

        return group;
    });

    // Single animation loop for all nodes
    function globalAnimate() {
        pulseObjects.forEach(obj => {
            obj.t += obj.speed;
            const scale = 1 + Math.sin(obj.t) * 0.1;
            obj.sphere.scale.set(scale, scale, scale);
            obj.glow.scale.set(scale, scale, scale);
        });
        requestAnimationFrame(globalAnimate);
    }
    globalAnimate();

    Graph.linkThreeObjectExtend(true)
        .linkDirectionalParticleColor(() => '#ffffff')
        .linkDirectionalParticleWidth(3);

    // Forces
    Graph.d3Force('charge').strength(-180);
    Graph.d3Force('link').distance(80);

    window.addEventListener('message', event => {
        const message = event.data;
        console.log('WebView: Received message', message.command);
        if (message.command === 'setData') {
            status.style.display = 'none';
            if (message.data && message.data.nodes && message.data.nodes.length > 0) {
                console.log(`WebView: Setting graph data with ${message.data.nodes.length} nodes`);
                Graph.graphData(message.data);
            } else {
                console.warn('WebView: Received empty or invalid data');
                status.innerText = 'No files found to visualize';
            }
        }
    });

    // Handshake
    console.log('WebView: Sending ready...');
    vscode.postMessage({ command: 'ready' });

    window.addEventListener('resize', () => {
        Graph.width(window.innerWidth).height(window.innerHeight);
    });
});
