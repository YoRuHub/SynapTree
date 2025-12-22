import { State } from "./state.js";
import { vscode } from "./vscode-api.js";
import { log } from "./utils.js";
import {
  setupUI,
  showContextMenu,
  hideContextMenu,
  hideSearch,
  searchNodes,
  updateBreadcrumbs,
} from "./ui.js";
import { createNodeObject, activateNode } from "./visuals.js";
import { GIT_STATUS_CONFIG } from "./constants.js";

const elem = document.getElementById("graph");
const status = document.getElementById("status");

// Init UI
setupUI();

// --- GRAPH INIT ---
try {
  State.Graph = ForceGraph3D()(elem)
    .backgroundColor("#000308")
    .nodeColor((node) => node.color || "#00ffff")
    .linkColor((link) =>
      State.highlightLinks.has(link)
        ? "rgba(255, 255, 0, 0.8)"
        : "rgba(255, 255, 255, 0.25)"
    )
    .linkWidth(1.5)
    .linkOpacity(1.0)
    .linkCurvature(0.2)
    .linkDirectionalParticles(1)
    .linkDirectionalParticleSpeed(0.006)
    .linkDirectionalParticleWidth(2.0)
    .showNavInfo(false)
    .onNodeClick((node) => {
      try {
        activateNode(node);
        updateBreadcrumbs(node);

        // Restore Left Click: Open File
        if (node && node.type === "file" && node.path) {
          vscode.postMessage({ command: "openFile", path: node.path });
        }
        hideContextMenu(); // Ensure menu closes on left click
      } catch (err) {
        log("Click Error: " + err.message);
      }
    })
    .onNodeRightClick((node) => {
      try {
        // Show Context Menu on Right Click
        if (node) {
          const coords = State.Graph.graph2ScreenCoords(node.x, node.y, node.z);
          showContextMenu(node, coords.x, coords.y);
        }
      } catch (err) {
        log("Right Click Error: " + err.message);
      }
    })
    .onBackgroundClick(() => {
      State.highlightLinks.clear();
      updateBreadcrumbs(null);
      State.Graph.linkColor(State.Graph.linkColor());

      // Hide UI
      hideContextMenu();
      hideSearch();
    })
    .nodeThreeObject(createNodeObject)
    .linkThreeObjectExtend(true)
    .linkDirectionalParticleColor((link) =>
      State.highlightLinks.has(link) ? "rgba(255, 255, 0, 0.6)" : "#ffffff"
    )
    .width(window.innerWidth)
    .height(window.innerHeight);

  // Debug Config
  // log(`Config check: ${JSON.stringify(window.synapTreeConfig)}`);

  // --- ANIMATION LOOP ---
  function animate() {
    State.pulseObjects.forEach((obj) => {
      obj.t += obj.speed;

      if (obj.isMatch) {
        const flashColor = obj.baseColor;
        obj.core.scale.set(1.5, 1.5, 1.5);
        obj.aura.visible = false;
        obj.innerGlow.visible = false;
        obj.ripple.visible = true;
        obj.ripple.material.color.set(flashColor);
        const rippleSpeed = 0.4; // Slower ripple (User Request)
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
        let targetOuterColor = "#ffffff"; // Default Glassy White
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
          obj.labelSprite.material.color.set(
            obj.node.gitStatus ? targetOuterColor : "#ffffff"
          );
        }
      }
    });
    requestAnimationFrame(animate);
  }
  animate();
} catch (err) {
  status.innerText = "Graph Init Error: " + err.message;
  log("Graph Init Error: " + err.stack);
}

// Runtime Error Handler
window.onerror = function (msg, url, line) {
  log(`Runtime Error: ${msg} at ${url}:${line}`);
};

// --- RESIZE HANDLER ---
window.addEventListener("resize", () => {
  if (State.Graph) {
    State.Graph.width(window.innerWidth);
    State.Graph.height(window.innerHeight);
  }
});

// --- HELPER to apply status ---
// --- HELPER to apply status ---
function applyNodeStatus(targetId, newStatus) {
  // log(`[Update] Request for: ${targetId} -> ${newStatus}`);

  // Normalize inputs to handle macOS NFD/NFC and case differences
  const normalizedTarget = (targetId || "").normalize("NFC");
  const lowerTarget = normalizedTarget.toLowerCase();

  // Try robust match
  let targetObj = State.pulseObjects.find((obj) => {
    const objId = (obj.nodeId || "").normalize("NFC");
    return objId === normalizedTarget;
  });

  // Try lower case match
  if (!targetObj) {
    targetObj = State.pulseObjects.find((obj) => {
      const objId = (obj.nodeId || "").normalize("NFC").toLowerCase();
      return objId === lowerTarget;
    });
    // if (targetObj) {
    //   log(`[Update] Fuzzy match found: ${targetObj.nodeId}`);
    // }
  }

  if (targetObj) {
    // log(`[Update] Applied to node: ${targetObj.node.name}`);
    targetObj.node.gitStatus = newStatus;
  } else {
    // log(`[Update] Node NOT FOUND for id: ${targetId}`);
  }
}

// --- MESSAGE HANDLER ---
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.command === "setData") {
    try {
      if (message.data && message.data.nodes) {
        // log(`Processing data: ${message.data.nodes.length} nodes`);
        status.innerText = "Rendering Graph...";

        // Toggle Reset Button
        State.isCustomRoot = message.isCustomRoot || false;
        const btn = document.getElementById("reset-root-btn");
        if (btn) {
          if (State.isCustomRoot) {
            btn.style.display = "flex";
          } else {
            btn.style.display = "none";
          }
        }

        State.pulseObjects.length = 0;
        State.Graph.graphData(message.data);
        status.style.display = "block";
        status.innerText = `${message.data.nodes.length} nodes loaded`;

        setTimeout(() => {
          status.style.display = "none";
          if (State.isFirstLoad) {
            // Use zoomToFit to auto-calculate distance based on graph size
            // Add a small delay to allow force engine to spread nodes
            setTimeout(() => {
              // State.Graph.zoomToFit(1000, 100); // User requested no auto-zoom
            }, 500);
            State.isFirstLoad = false;
          }

          // --- SMART FOCUS (New Feature) ---
          if (message.focusTargetId) {
            const { nodes } = State.Graph.graphData();
            const targetNode = nodes.find(
              (n) => n.id === message.focusTargetId
            );
            if (targetNode) {
              const distance = 120;
              const distRatio =
                1 +
                distance / Math.hypot(targetNode.x, targetNode.y, targetNode.z);
              const newPos = {
                x: targetNode.x * distRatio,
                y: targetNode.y * distRatio,
                z: targetNode.z * distRatio,
              };

              State.Graph.cameraPosition(newPos, targetNode, 1500);
              activateNode(targetNode);
              updateBreadcrumbs(targetNode);
              // log(`Smart Focused on: ${targetNode.name}`);
            }
          }

          // --- PROCESS QUEUE ---
          if (State.pendingUpdates.size > 0) {
            // log(
            //   `Processing ${State.pendingUpdates.size} queued git updates...`
            // );
            State.pendingUpdates.forEach((st, id) => {
              applyNodeStatus(id, st);
            });
            State.pendingUpdates.clear();
          }
        }, 1500);
        // log("Data applied successfully");
      } else {
        log("Received empty or invalid data");
        status.innerText = "Error: No nodes found in workspace";
      }
    } catch (err) {
      log("setData Error: " + err.message);
      status.innerText = "Error processing data: " + err.message;
    }
  } else if (message.command === "search") {
    const searchContainer = document.getElementById("search-container");
    if (searchContainer) {
      // Toggle Logic: If query is empty, treat as a toggle
      if (!message.query) {
        if (searchContainer.classList.contains("visible")) {
          // If already visible, hide it (Toggle Off)
          hideSearch();
          return;
        } else {
          // IF hidden, show and focus (Toggle On)
          searchContainer.classList.add("visible");
          const searchInput = document.getElementById("search-input");
          setTimeout(() => searchInput && searchInput.focus(), 100);
          return;
        }
      }

      // If query is present (Programmatic Search), ensure visible
      if (!searchContainer.classList.contains("visible")) {
        searchContainer.classList.add("visible");
        const searchInput = document.getElementById("search-input");
        setTimeout(() => searchInput && searchInput.focus(), 100);
      }
    }
    if (message.query) {
      const searchInput = document.getElementById("search-input");
      if (searchInput) {
        searchInput.value = message.query;
        searchNodes(message.query);
      }
    }
  } else if (message.command === "setLabels") {
    window.showLabels = message.visible;
    State.pulseObjects.forEach((obj) => {
      if (obj.labelSprite) {
        obj.labelSprite.visible = window.showLabels;
      }
    });
  } else if (message.command === "updateNodeStatus") {
    if (!State.Graph || State.pulseObjects.length === 0) {
      State.pendingUpdates.set(message.id, message.gitStatus);
    } else {
      applyNodeStatus(message.id, message.gitStatus);
    }
  } else if (message.command === "updateNodeStatusBatch") {
    if (message.changes) {
      const changes = message.changes;
      if (!State.Graph || State.pulseObjects.length === 0) {
        // Queue
        Object.entries(changes).forEach(([id, status]) => {
          State.pendingUpdates.set(id, status);
        });
      } else {
        // Apply
        Object.entries(changes).forEach(([id, status]) => {
          applyNodeStatus(id, status);
        });
      }
    }
  } else if (message.command === "focusNode") {
    // Auto Focus logic
    const targetId = message.id;
    if (State.Graph) {
      const { nodes } = State.Graph.graphData();
      const targetNode = nodes.find(
        (n) => n.id === targetId || n.path === targetId
      );
      if (targetNode) {
        const distance = 120;
        const distRatio =
          1 + distance / Math.hypot(targetNode.x, targetNode.y, targetNode.z);
        const newPos = {
          x: targetNode.x * distRatio,
          y: targetNode.y * distRatio,
          z: targetNode.z * distRatio,
        };
        State.Graph.cameraPosition(newPos, targetNode, 1500);
        State.Graph.cameraPosition(newPos, targetNode, 1500);
        activateNode(targetNode);
        updateBreadcrumbs(targetNode);
        log(`Auto Focused on: ${targetNode.name}`);
      }
    }
  } else if (message.command === "addNode") {
    const { node, parentId } = message;
    if (State.Graph) {
      const { nodes, links } = State.Graph.graphData();
      // Check duplicate
      if (!nodes.find(n => n.id === node.id)) {
        nodes.push(node);
        if (parentId) {
          links.push({ source: parentId, target: node.id });
        }
        State.Graph.graphData({ nodes, links });
        log(`[Graph] Added node: ${node.name}`);
      }
    }
  } else if (message.command === "removeNode") {
    const { id } = message;
    if (State.Graph) {
      const { nodes, links } = State.Graph.graphData();
      const newNodes = nodes.filter(n => n.id !== id);

      // Filter links where source or target matches id
      // Note: d3-force converts links to objects {source: Node, target: Node, ...}
      const newLinks = links.filter(l => {
        const sId = (typeof l.source === 'object') ? l.source.id : l.source;
        const tId = (typeof l.target === 'object') ? l.target.id : l.target;
        return sId !== id && tId !== id;
      });

      if (nodes.length !== newNodes.length) {
        State.Graph.graphData({ nodes: newNodes, links: newLinks });
        log(`[Graph] Removed node: ${id}`);
      }
    }
  }
});

// Notify extension that we are ready to receive data
vscode.postMessage({ command: "ready" });
