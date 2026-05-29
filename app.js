const NODE_COLOR = "#8b5cf6";
const EDGE_COLOR = "#1d4ed8";
const PATH_COLOR = "#dc2626";
const MARKER_ICON_CLASS = {
    start: "marker-start",
    goal: "marker-goal",
    agent: "marker-agent"
};
const VISUALIZE_EVERY_NTH_VISIT = 5;
const EDGE_VISUALIZE_EVERY_NTH_VISIT = 14;
const YIELD_EVERY_NTH_VISIT = 50;
const SEARCH_YIELD_DELAY_MS = 4;
const INTRO_BLINK_DURATION_MS = 1500;
const AGENT_STEP_DELAY_MS = 18;
const PATH_DRAW_DELAY_MS = 8;

class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    enqueue(element) {
        this.heap.push(element);
        this.bubbleUp(this.heap.length - 1);
    }

    dequeue() {
        if (this.isEmpty()) return null;

        const min = this.heap[0];
        const end = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.bubbleDown(0);
        }

        return min;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].f <= this.heap[index].f) break;

            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }

    bubbleDown(index) {
        const length = this.heap.length;

        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let smallest = index;

            if (left < length && this.heap[left].f < this.heap[smallest].f) {
                smallest = left;
            }

            if (right < length && this.heap[right].f < this.heap[smallest].f) {
                smallest = right;
            }

            if (smallest === index) break;

            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function haversineDistance(coord1, coord2) {
    const radiusKm = 6371;
    const lat1 = toRadians(coord1[1]);
    const lon1 = toRadians(coord1[0]);
    const lat2 = toRadians(coord2[1]);
    const lon2 = toRadians(coord2[0]);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function nodeLatLng(nodeIndex) {
    return [nodes[nodeIndex][1], nodes[nodeIndex][0]];
}

function makeIcon(type) {
    return L.divIcon({
        className: `route-marker ${MARKER_ICON_CLASS[type]}`,
        html: "<span></span>",
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });
}

const map = L.map("map", {
    zoomControl: false
}).setView([35.672, 139.650], 10);

L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap contributors © CARTO",
    maxZoom: 20
}).addTo(map);

let nodes = [];
let edges = [];
let startNodeIndex = 0;
let goalNodeIndex = null;
let selectionMode = "goal";
let runId = 0;
let isRunning = false;
let isIntroPlaying = false;
let agentMarker = null;

const nodeLayer = L.layerGroup().addTo(map);
const boundaryLayer = L.layerGroup().addTo(map);
const selectionLayer = L.layerGroup().addTo(map);
const searchLayer = L.layerGroup().addTo(map);
const pathLayer = L.layerGroup().addTo(map);

const statusEl = document.getElementById("status");
const startValueEl = document.getElementById("startValue");
const goalValueEl = document.getElementById("goalValue");
const runButton = document.getElementById("runButton");
const resetButton = document.getElementById("resetButton");
const algorithmSelect = document.getElementById("algorithmSelect");
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
const hudPhaseEl = document.getElementById("hudPhase");
const hudAlgorithmEl = document.getElementById("hudAlgorithm");
const hudVisitedEl = document.getElementById("hudVisited");
const hudDistanceEl = document.getElementById("hudDistance");

function setStatus(message) {
    statusEl.textContent = message;
    hudPhaseEl.textContent = message;
}

function formatKm(value) {
    if (value < 1) return `${Math.round(value * 1000)} m`;
    return `${value.toFixed(2)} km`;
}

function formatCount(value) {
    return Intl.NumberFormat("en-US").format(value);
}

function formatAlgorithm(algorithm) {
    return algorithm === "astar" ? "A*" : "Dijkstra";
}

function pathDistance(path) {
    let total = 0;

    for (let i = 0; i < path.length - 1; i++) {
        total += haversineDistance(nodes[path[i]], nodes[path[i + 1]]);
    }

    return total;
}

function updateSelectionLabels() {
    startValueEl.textContent = startNodeIndex === null ? "未選択" : `ノード ${startNodeIndex}`;
    goalValueEl.textContent = goalNodeIndex === null ? "未選択" : `ノード ${goalNodeIndex}`;
    runButton.disabled = isRunning || isIntroPlaying || startNodeIndex === null || goalNodeIndex === null || startNodeIndex === goalNodeIndex;
}

function setSelectionMode(mode) {
    selectionMode = mode;
    modeButtons.forEach(button => {
        button.classList.toggle("is-active", button.dataset.mode === mode);
    });
    setStatus(mode === "start" ? "地図上で始点ノードを選択してください。" : "地図上で終点ノードを選択してください。");
}

function drawSelectionMarkers() {
    selectionLayer.clearLayers();

    if (startNodeIndex !== null) {
        L.marker(nodeLatLng(startNodeIndex), { icon: makeIcon("start") })
            .addTo(selectionLayer)
            .bindPopup(`始点: ノード ${startNodeIndex}`);
    }

    if (goalNodeIndex !== null) {
        L.marker(nodeLatLng(goalNodeIndex), { icon: makeIcon("goal") })
            .addTo(selectionLayer)
            .bindPopup(`終点: ノード ${goalNodeIndex}`);
    }
}

function selectNode(nodeIndex) {
    if (isRunning || isIntroPlaying) return;

    if (selectionMode === "start") {
        startNodeIndex = nodeIndex;
        if (goalNodeIndex === nodeIndex) goalNodeIndex = null;
        setSelectionMode("goal");
    } else {
        goalNodeIndex = nodeIndex;
        if (startNodeIndex === nodeIndex) startNodeIndex = null;
    }

    clearVisualization();
    drawSelectionMarkers();
    updateSelectionLabels();
}

function renderSelectableNodes() {
    nodeLayer.clearLayers();
}

function clearVisualization() {
    runId += 1;
    searchLayer.clearLayers();
    pathLayer.clearLayers();

    if (agentMarker) {
        map.removeLayer(agentMarker);
        agentMarker = null;
    }
}

function findNearestRoadNode(lat, lng) {
    let nearestIndex = null;
    let nearestDistance = Infinity;

    for (let i = 0; i < nodes.length; i++) {
        const distance = haversineDistance([lng, lat], nodes[i]);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
        }
    }

    return {
        index: nearestIndex,
        distanceKm: nearestDistance
    };
}

function handleMapClick(event) {
    if (nodes.length === 0 || isRunning || isIntroPlaying) return;

    const { lat, lng } = event.latlng;
    const nearest = findNearestRoadNode(lat, lng);
    const mode = selectionMode;

    selectNode(nearest.index);
    setStatus(`${mode === "start" ? "始点" : "終点"}をノード ${nearest.index} に設定しました（クリック位置から ${formatKm(nearest.distanceKm)}）。`);
}

function findFarthestNodeFrom(nodeIndex) {
    let farthestIndex = nodeIndex;
    let farthestDistance = -Infinity;

    for (let i = 0; i < nodes.length; i++) {
        const distance = haversineDistance(nodes[nodeIndex], nodes[i]);
        if (distance > farthestDistance) {
            farthestDistance = distance;
            farthestIndex = i;
        }
    }

    return farthestIndex;
}

function findDemoEndpoints() {
    const firstEndpoint = findFarthestNodeFrom(0);
    const secondEndpoint = findFarthestNodeFrom(firstEndpoint);

    return {
        start: firstEndpoint,
        goal: secondEndpoint
    };
}

async function blinkSelectionMarker(nodeIndex, type, label) {
    const marker = L.marker(nodeLatLng(nodeIndex), { icon: makeIcon(type) })
        .addTo(selectionLayer)
        .bindPopup(label);

    const startedAt = performance.now();
    let visible = true;

    while (performance.now() - startedAt < INTRO_BLINK_DURATION_MS) {
        visible = !visible;
        marker.setOpacity(visible ? 1 : 0.2);
        await delay(280);
    }

    marker.setOpacity(1);
}

async function playIntroAndRun() {
    isIntroPlaying = true;
    updateSelectionLabels();
    selectionLayer.clearLayers();
    searchLayer.clearLayers();
    pathLayer.clearLayers();

    setStatus("始点を選択しました。まもなくデモを開始します。");
    await blinkSelectionMarker(startNodeIndex, "start", `始点: ノード ${startNodeIndex}`);

    setStatus("終点を選択しました。");
    await blinkSelectionMarker(goalNodeIndex, "goal", `終点: ノード ${goalNodeIndex}`);

    drawSelectionMarkers();
    isIntroPlaying = false;
    updateSelectionLabels();
    await runVisualization();
}

function reconstructPath(prev, endNode) {
    const path = [];
    let current = endNode;

    while (current !== null) {
        path.push(current);
        current = prev[current];
    }

    return path.reverse();
}

async function drawPath(path, currentRunId) {
    for (let i = 0; i < path.length - 1; i++) {
        if (currentRunId !== runId) return;

        L.polyline([nodeLatLng(path[i]), nodeLatLng(path[i + 1])], {
            color: "#fb7185",
            weight: 15,
            opacity: 0.3,
            lineCap: "round",
            lineJoin: "round"
        }).addTo(pathLayer);

        L.polyline([nodeLatLng(path[i]), nodeLatLng(path[i + 1])], {
            color: PATH_COLOR,
            weight: 5,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round"
        }).addTo(pathLayer);

        if (i % 2 === 0) {
            await delay(PATH_DRAW_DELAY_MS);
        }
    }
}

function drawVisitedNode(nodeIndex) {
    const circle = L.circleMarker(nodeLatLng(nodeIndex), {
        radius: 3.5,
        color: "#c4b5fd",
        weight: 1,
        opacity: 0.9,
        fillColor: "#8b5cf6",
        fillOpacity: 0.55,
        interactive: false
    }).addTo(searchLayer);

    const startedAt = performance.now();
    const duration = 720;
    const animation = setInterval(() => {
        const progress = Math.min((performance.now() - startedAt) / duration, 1);
        circle.setRadius(3.5 + progress * 5.5);
        circle.setStyle({
            opacity: 0.9 * (1 - progress),
            fillOpacity: 0.55 * (1 - progress)
        });

        if (progress >= 1) {
            clearInterval(animation);
            searchLayer.removeLayer(circle);
        }
    }, 33);
}

function flashEdge(fromNode, toNode) {
    const polyline = L.polyline([nodeLatLng(fromNode), nodeLatLng(toNode)], {
        color: EDGE_COLOR,
        weight: 2.5,
        opacity: 0.85
    }).addTo(searchLayer);

    let opacity = 0.85;
    const animation = setInterval(() => {
        opacity -= 0.1;
        if (opacity <= 0) {
            clearInterval(animation);
            searchLayer.removeLayer(polyline);
            return;
        }
        polyline.setStyle({ opacity });
    }, 45);
}

function heuristic(nodeIndex, goalIndex, algorithm) {
    if (algorithm === "dijkstra") return 0;
    return haversineDistance(nodes[nodeIndex], nodes[goalIndex]);
}

async function findPath({ algorithm, start, goal, currentRunId }) {
    const dist = new Array(nodes.length).fill(Infinity);
    const prev = new Array(nodes.length).fill(null);
    const visited = new Set();
    const pq = new PriorityQueue();

    dist[start] = 0;
    pq.enqueue({
        node: start,
        g: 0,
        h: heuristic(start, goal, algorithm),
        f: heuristic(start, goal, algorithm)
    });

    while (!pq.isEmpty()) {
        if (currentRunId !== runId) return null;

        const current = pq.dequeue();
        const currentNode = current.node;

        if (visited.has(currentNode)) continue;
        visited.add(currentNode);

        if (visited.size % 500 === 0) {
            hudVisitedEl.textContent = formatCount(visited.size);
        }

        if (visited.size % VISUALIZE_EVERY_NTH_VISIT === 0 || currentNode === start) {
            drawVisitedNode(currentNode);
        }

        if (currentNode === goal) {
            return {
                path: reconstructPath(prev, goal),
                visitedCount: visited.size
            };
        }

        for (const [neighbor, weight] of edges[currentNode]) {
            if (visited.has(neighbor)) continue;

            const tentativeG = dist[currentNode] + weight;
            if (tentativeG >= dist[neighbor]) continue;

            dist[neighbor] = tentativeG;
            prev[neighbor] = currentNode;

            const h = heuristic(neighbor, goal, algorithm);
            pq.enqueue({
                node: neighbor,
                g: tentativeG,
                h,
                f: tentativeG + h
            });

        if (visited.size % EDGE_VISUALIZE_EVERY_NTH_VISIT === 0) {
            flashEdge(currentNode, neighbor);
        }
        }

        if (visited.size % YIELD_EVERY_NTH_VISIT === 0) {
            await delay(SEARCH_YIELD_DELAY_MS);
        }
    }

    return null;
}

async function animatePath(path, stepDelay, currentRunId) {
    agentMarker = L.marker(nodeLatLng(path[0]), {
        icon: makeIcon("agent")
    }).addTo(map).bindPopup("最短経路");

    for (const nodeIndex of path) {
        if (currentRunId !== runId) return;

        agentMarker.setLatLng(nodeLatLng(nodeIndex)).update();
        await delay(stepDelay);
    }
}

async function runVisualization() {
    if (isRunning || startNodeIndex === null || goalNodeIndex === null || startNodeIndex === goalNodeIndex) return;

    clearVisualization();
    isRunning = true;
    updateSelectionLabels();

    const currentRunId = runId;
    const algorithm = algorithmSelect.value;

    const algorithmLabel = formatAlgorithm(algorithm);

    hudAlgorithmEl.textContent = algorithmLabel;
    hudVisitedEl.textContent = "0";
    hudDistanceEl.textContent = "--";
    setStatus(`ノード ${startNodeIndex} から ノード ${goalNodeIndex} へ ${algorithmLabel} を実行中です。`);

    const result = await findPath({
        algorithm,
        start: startNodeIndex,
        goal: goalNodeIndex,
        currentRunId
    });

    if (currentRunId !== runId) {
        isRunning = false;
        updateSelectionLabels();
        return;
    }

    if (!result) {
        setStatus("選択したノード間に経路が見つかりませんでした。");
        isRunning = false;
        updateSelectionLabels();
        return;
    }

    const distance = pathDistance(result.path);
    hudVisitedEl.textContent = formatCount(result.visitedCount);
    hudDistanceEl.textContent = formatKm(distance);
    setStatus(`最短経路を発見しました: ${formatKm(distance)}。`);
    await drawPath(result.path, currentRunId);
    await animatePath(result.path, AGENT_STEP_DELAY_MS, currentRunId);

    isRunning = false;
    updateSelectionLabels();
}

async function loadGraph() {
    setStatus("地図データを読み込み中。");

    const [dataResponse, edgesResponse, boundaryResponse] = await Promise.all([
        fetch("data/tokyo23-drive-nodes.json"),
        fetch("data/tokyo23-drive-edges.json"),
        fetch("data/tokyo23-wards-boundary.geojson")
    ]);

    nodes = await dataResponse.json();
    edges = await edgesResponse.json();
    const boundary = await boundaryResponse.json();
    const demoEndpoints = findDemoEndpoints();
    startNodeIndex = demoEndpoints.start;
    goalNodeIndex = demoEndpoints.goal;

    L.geoJSON(boundary, {
        style: {
            color: "#0f172a",
            weight: 3,
            opacity: 0.78,
            fillOpacity: 0,
            dashArray: "8 8"
        }
    }).addTo(boundaryLayer);

    renderSelectableNodes();
    updateSelectionLabels();
    setSelectionMode("goal");
    map.fitBounds([nodeLatLng(startNodeIndex), nodeLatLng(goalNodeIndex)], {
        padding: [80, 80],
        maxZoom: 12
    });
    await playIntroAndRun();
}

modeButtons.forEach(button => {
    button.addEventListener("click", () => setSelectionMode(button.dataset.mode));
});

runButton.addEventListener("click", runVisualization);
resetButton.addEventListener("click", () => {
    clearVisualization();
    drawSelectionMarkers();
    updateSelectionLabels();
    setStatus("表示をクリアしました。");
});

map.on("click", handleMapClick);

window.addEventListener("load", () => {
    loadGraph().catch(error => {
        console.error("Error loading graph data:", error);
        setStatus("地図データの読み込みに失敗しました。");
    });
});
