import { State } from './state.js';
import { GIT_STATUS_CONFIG } from './constants.js';
import { log } from './utils.js';

window.showLabels = true; // Still global for now or move to State

const geometryCache = {
    coreDir: new THREE.IcosahedronGeometry(10, 1),
    coreFile: new THREE.IcosahedronGeometry(6, 0),
    coreRoot: new THREE.SphereGeometry(12, 32, 32),
    innerGlowDir: new THREE.IcosahedronGeometry(11, 1),
    innerGlowFile: new THREE.IcosahedronGeometry(7, 0),
    innerGlowRoot: new THREE.SphereGeometry(13.5, 32, 32),
    auraDir: new THREE.SphereGeometry(14, 16, 16),
    auraFile: new THREE.IcosahedronGeometry(9, 0),
    auraRoot: new THREE.SphereGeometry(17, 32, 32)
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

export function createNodeObject(node) {
    const isDir = node.type === 'directory';

    // Base Color: Determined by file type or default
    const baseColor = node.color || (isDir ? '#0088ff' : '#aaaaaa');

    // Defaults
    let auraColor = '#ffffff';
    let innerColor = baseColor;

    let opacityGlow = GIT_STATUS_CONFIG.default.opacityGlow;
    let opacityAura = 0.00; // Completely transparent default
    let emissiveInt = 0.5;

    // Apply Configuration from central object (Overrides defaults if status exists)
    if (node.gitStatus && GIT_STATUS_CONFIG[node.gitStatus]) {
        const conf = GIT_STATUS_CONFIG[node.gitStatus];
        auraColor = conf.color;
        // innerColor remains baseColor
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
        (node.type === 'root') ? geometryCache.coreRoot : (isDir ? geometryCache.coreDir : geometryCache.coreFile),
        coreMat
    );
    group.add(core);

    // 2. Inner Glow
    const glowMat = getCachedMaterial(innerColor, 'inner').clone();
    glowMat.opacity = opacityGlow;
    const innerGlow = new THREE.Mesh(
        (node.type === 'root') ? geometryCache.innerGlowRoot : (isDir ? geometryCache.innerGlowDir : geometryCache.innerGlowFile),
        glowMat
    );
    group.add(innerGlow);
    innerGlow.visible = true;

    // 3. Outer Aura
    const auraMat = getCachedMaterial(auraColor, 'aura').clone();
    auraMat.opacity = opacityAura;
    const aura = new THREE.Mesh(
        (node.type === 'root') ? geometryCache.auraRoot : (isDir ? geometryCache.auraDir : geometryCache.auraFile),
        auraMat
    );
    group.add(aura);
    aura.visible = true;

    // 4. Label
    const labelSprite = createTextSprite(node.name);
    const yOffset = isDir ? -28 : -22;
    labelSprite.position.y = yOffset;
    labelSprite.material.color.set(node.gitStatus ? auraColor : '#ffffff');
    labelSprite.visible = (window.showLabels !== false);
    group.add(labelSprite);

    // 5. Ripple
    const ripple = createRippleSprite();
    ripple.visible = false;
    ripple.scale.set(0, 0, 0);
    group.add(ripple);

    State.pulseObjects.push({
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
        baseScale: isDir ? 18 : 12,
        baseColor: baseColor
    });

    return group;
}

export function activateNode(node) {
    State.highlightLinks.clear();
    if (node) {
        const { links } = State.Graph.graphData();
        const traverse = (n) => {
            links.forEach(l => {
                const s = l.source.id || l.source;
                if (s === n.id) {
                    State.highlightLinks.add(l);
                    traverse(l.target);
                }
            });
        };
        traverse(node);
    }
    State.Graph.linkColor(State.Graph.linkColor());
}
