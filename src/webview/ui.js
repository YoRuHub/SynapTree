import { State } from './state.js';
import { vscode } from './vscode-api.js';
import { ICONS } from './constants.js';
import { t } from './utils.js';
import { activateNode } from './visuals.js'; // Circular dependency risk? No, visuals.js uses State, not ui.js

// --- RESET ROOT BUTTON ---
const resetRootBtn = document.createElement('div');
resetRootBtn.id = 'reset-root-btn';
resetRootBtn.innerHTML = `${ICONS.resetRoot} <span style="margin-left:6px;">${t('Reset Root', 'Reset Root')}</span>`;
resetRootBtn.style.cssText = `
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(20, 25, 40, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 8px 16px;
    color: #fff;
    font-family: sans-serif;
    font-size: 13px;
    cursor: pointer;
    display: none; /* Hidden by default */
    align-items: center;
    transition: all 0.2s;
    z-index: 2000;
`;
resetRootBtn.onmouseenter = () => { resetRootBtn.style.background = 'rgba(40, 45, 70, 0.9)'; };
resetRootBtn.onmouseleave = () => { resetRootBtn.style.background = 'rgba(20, 25, 40, 0.85)'; };
resetRootBtn.onclick = () => {
    vscode.postMessage({ command: 'nodeAction', action: 'resetRoot', path: 'root' });
};

export function setupUI() {
    document.body.appendChild(resetRootBtn);
    document.body.appendChild(menuEl);

    // Close menu when clicking outside
    document.addEventListener('mousedown', (e) => {
        if (menuEl.style.display !== 'none' && !menuEl.contains(e.target)) {
            hideContextMenu();
        }
    });

    // Search Init
    setupSearch();
}

// --- CONTEXT MENU UI ---
const menuEl = document.createElement('div');
menuEl.id = 'node-context-menu';
menuEl.style.cssText = `
    position: absolute;
    display: none;
    background: rgba(20, 25, 40, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 8px;
    min-width: 180px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    z-index: 2000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    color: #f0f0f0;
    pointer-events: auto;
    overflow: hidden;
    animation: fadeIn 0.1s ease-out;
`;

export function showContextMenu(node, x, y) {
    if (!node) return;
    menuEl.innerHTML = '';

    // Define Actions
    const actions = [];
    if (node.type === 'directory' || node.type === 'root') {
        actions.push(
            { label: t('Focus'), id: 'focus', icon: ICONS.focus }
        );

        if (node.type === 'root') {
            if (typeof State.isCustomRoot !== 'undefined' && State.isCustomRoot) {
                // If currently zoomed in, the root node allows going back
                actions.push({ label: t('Reset Root'), id: 'resetRoot', icon: ICONS.resetRoot });
            }
        } else if (node.type === 'directory') {
            // Standard directory -> Can delve deeper
            actions.push({ label: t('Set as Root'), id: 'setRoot', icon: ICONS.setRoot });
        }

        actions.push(
            { label: '---' },
            { label: t('New Folder'), id: 'createFolder', icon: ICONS.folderAdd },
            { label: t('New File'), id: 'createFile', icon: ICONS.fileAdd },
            { label: '---' },
            { label: t('Rename'), id: 'rename', icon: ICONS.rename },
            { label: t('Delete'), id: 'delete', danger: true, icon: ICONS.delete }
        );
    } else {
        actions.push(
            { label: t('Focus'), id: 'focus', icon: ICONS.focus },
            { label: '---' },
            { label: t('Rename'), id: 'rename', icon: ICONS.rename },
            { label: t('Delete'), id: 'delete', danger: true, icon: ICONS.delete }
        );
    }

    // Build DOM
    actions.forEach(action => {
        if (action.label === '---') {
            const hr = document.createElement('div');
            hr.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 6px 4px;';
            menuEl.appendChild(hr);
            return;
        }

        const item = document.createElement('div');
        item.innerHTML = `<span style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-right: 10px; opacity: 0.8;">${action.icon || ''}</span>${action.label}`;
        item.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
            color: ${action.danger ? '#ff6666' : '#eeeeee'};
            display: flex;
            align-items: center;
            font-weight: 500;
            letter-spacing: 0.3px;
        `;

        item.onmouseenter = () => {
            item.style.background = action.danger ? 'rgba(255, 50, 50, 0.15)' : 'rgba(255, 255, 255, 0.1)';
            item.style.transform = 'translateX(2px)';
        };
        item.onmouseleave = () => {
            item.style.background = 'transparent';
            item.style.transform = 'translateX(0)';
        };

        item.onclick = (e) => {
            e.stopPropagation();
            hideContextMenu();
            handleMenuAction(action.id, node);
        };
        menuEl.appendChild(item);
    });

    // Ensure menu fits on screen
    const menuWidth = 180;
    const menuHeight = actions.length * 36 + 20; // Approx

    let finalX = x;
    let finalY = y;

    if (x + menuWidth > window.innerWidth) finalX = window.innerWidth - menuWidth - 20;
    if (y + menuHeight > window.innerHeight) finalY = window.innerHeight - menuHeight - 20;

    menuEl.style.left = `${finalX}px`;
    menuEl.style.top = `${finalY}px`;
    menuEl.style.display = 'block';
}

export function hideContextMenu() {
    menuEl.style.display = 'none';
}

function handleMenuAction(actionId, node) {
    if (actionId === 'focus') {
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        const newPos = { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio };
        if (State.Graph) {
            State.Graph.cameraPosition(newPos, node, 1500);
            activateNode(node);
        }
        return;
    }

    // Post to Extension
    vscode.postMessage({
        command: 'nodeAction',
        action: actionId,
        path: node.path,
        type: node.type
    });
}

// --- SEARCH ---
let matchedNodes = [];
let currentMatchIndex = -1;

export function searchNodes(query) {
    query = query.toLowerCase().trim();
    const searchStatus = document.getElementById('status');
    matchedNodes = [];
    currentMatchIndex = -1;

    if (!query) {
        searchStatus.style.display = 'none';
        State.pulseObjects.forEach(obj => { obj.isMatch = false; });
        updateNavState();
        return;
    }

    if (State.Graph) {
        const { nodes } = State.Graph.graphData();
        State.pulseObjects.forEach(obj => {
            const node = nodes.find(n => n.id === obj.nodeId || n === obj.node);
            if (node && node.name.toLowerCase().includes(query)) {
                obj.isMatch = true;
                matchedNodes.push(node);
            } else {
                obj.isMatch = false;
            }
        });

        if (matchedNodes.length > 0) {
            searchStatus.innerText = `${matchedNodes.length} matches found`;
            searchStatus.style.display = 'block';
            searchStatus.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
            currentMatchIndex = 0;
            focusOnNode(matchedNodes[0]);
        } else {
            searchStatus.innerText = 'No matches found';
            searchStatus.style.display = 'block';
            searchStatus.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        }
        updateNavState();
    }
}

export function hideSearch() {
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchStatus = document.getElementById('status');
    const searchCount = document.getElementById('search-results-count');

    if (searchContainer && searchContainer.classList.contains('visible')) {
        searchContainer.classList.remove('visible');
        if (searchInput) searchInput.value = '';
        State.pulseObjects.forEach(obj => { obj.isMatch = false; });
        searchStatus.style.display = 'none';
        matchedNodes = [];
        currentMatchIndex = -1;
        if (searchCount) searchCount.innerText = '';
    }
}

function focusOnNode(node) {
    if (!node || !State.Graph) return;
    const distance = 120;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    const newPos = node.x || node.y || node.z
        ? { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
        : { x: 0, y: 0, z: distance };
    State.Graph.cameraPosition(newPos, node, 1500);
}

function updateNavState() {
    const searchPrev = document.getElementById('search-prev');
    const searchNext = document.getElementById('search-next');
    const searchCount = document.getElementById('search-results-count');

    if (matchedNodes.length > 0) {
        if (searchCount) searchCount.innerText = `${currentMatchIndex + 1} / ${matchedNodes.length}`;
        if (searchPrev) searchPrev.style.display = 'flex';
        if (searchNext) searchNext.style.display = 'flex';
    } else {
        if (searchCount) searchCount.innerText = '';
        if (searchPrev) searchPrev.style.display = 'none';
        if (searchNext) searchNext.style.display = 'none';
    }
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.placeholder = t('Search structures...');
        searchInput.addEventListener('input', () => {
            searchNodes(searchInput.value);
        });
    }

    const searchPrev = document.getElementById('search-prev');
    if (searchPrev) {
        searchPrev.addEventListener('click', () => {
            if (matchedNodes.length === 0) return;
            currentMatchIndex = (currentMatchIndex - 1 + matchedNodes.length) % matchedNodes.length;
            focusOnNode(matchedNodes[currentMatchIndex]);
            updateNavState();
        });
    }

    const searchNext = document.getElementById('search-next');
    if (searchNext) {
        searchNext.addEventListener('click', () => {
            if (matchedNodes.length === 0) return;
            currentMatchIndex = (currentMatchIndex + 1) % matchedNodes.length;
            focusOnNode(matchedNodes[currentMatchIndex]);
            updateNavState();
        });
    }
}

export function updateBreadcrumbs(node) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    if (!node) {
        breadcrumb.style.display = 'none';
        return;
    }

    // Traverse up from node to root
    const pathNodes = [node];
    let current = node;
    const { links, nodes } = State.Graph.graphData();

    // Prevent infinite loops
    let limit = 0;
    while (current && limit < 100) {
        const link = links.find(l => {
            const tId = l.target.id || l.target;
            return tId === current.id;
        });

        if (link) {
            const sourceId = link.source.id || link.source;
            const parent = nodes.find(n => n.id === sourceId);
            if (parent) {
                pathNodes.unshift(parent);
                current = parent;
            } else {
                break;
            }
        } else {
            break;
        }
        limit++;
    }

    // Render
    breadcrumb.innerHTML = '';
    pathNodes.forEach((n, index) => {
        const item = document.createElement('span');
        item.className = 'breadcrumb-item';
        // Use full path for tooltip?
        item.title = n.path || n.name;
        item.innerText = n.name;
        
        item.onclick = (e) => {
            e.stopPropagation();
            focusOnNode(n);
            activateNode(n); // Highlight links
            updateBreadcrumbs(n);
        };

        breadcrumb.appendChild(item);

        if (index < pathNodes.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.innerText = '/';
            breadcrumb.appendChild(sep);
        }
    });

    breadcrumb.style.display = 'flex';
    // Auto-scroll to the right so the current file is visible
    breadcrumb.scrollLeft = breadcrumb.scrollWidth;
}
