#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    enqueue(item) {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }

    dequeue() {
        if (this.heap.length === 0) return null;

        const min = this.heap[0];
        const end = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.bubbleDown(0);
        }

        return min;
    }

    get isEmpty() {
        return this.heap.length === 0;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
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

            if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
                smallest = left;
            }

            if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
                smallest = right;
            }

            if (smallest === index) break;
            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatNumber(value) {
    return Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

function getBounds(nodes) {
    let lngMin = Infinity;
    let lngMax = -Infinity;
    let latMin = Infinity;
    let latMax = -Infinity;

    for (const [lng, lat] of nodes) {
        lngMin = Math.min(lngMin, lng);
        lngMax = Math.max(lngMax, lng);
        latMin = Math.min(latMin, lat);
        latMax = Math.max(latMax, lat);
    }

    return { lngMin, lngMax, latMin, latMax };
}

function inspectIntegrity(nodes, edges) {
    const invalidNodes = [];
    const invalidEdges = [];
    const invalidWeights = [];
    const outDegree = new Array(nodes.length).fill(0);
    const inDegree = new Array(nodes.length).fill(0);
    const weights = [];

    nodes.forEach((node, index) => {
        if (
            !Array.isArray(node) ||
            node.length !== 2 ||
            !Number.isFinite(node[0]) ||
            !Number.isFinite(node[1])
        ) {
            invalidNodes.push(index);
        }
    });

    edges.forEach((neighbors, fromIndex) => {
        if (!Array.isArray(neighbors)) {
            invalidEdges.push({ fromIndex, reason: "neighbors is not an array" });
            return;
        }

        outDegree[fromIndex] = neighbors.length;

        for (const edge of neighbors) {
            if (!Array.isArray(edge) || edge.length !== 2) {
                invalidEdges.push({ fromIndex, edge, reason: "edge must be [neighbor, weight]" });
                continue;
            }

            const [toIndex, weight] = edge;
            if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= nodes.length) {
                invalidEdges.push({ fromIndex, edge, reason: "neighbor index out of range" });
                continue;
            }

            if (!Number.isFinite(weight) || weight <= 0) {
                invalidWeights.push({ fromIndex, edge });
                continue;
            }

            inDegree[toIndex] += 1;
            weights.push(weight);
        }
    });

    const isolatedNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        if (inDegree[i] === 0 && outDegree[i] === 0) isolatedNodes.push(i);
    }

    return {
        invalidNodes,
        invalidEdges,
        invalidWeights,
        isolatedNodes,
        outDegree,
        inDegree,
        weights,
    };
}

function summarizeWeights(weights) {
    const sorted = [...weights].sort((a, b) => a - b);
    const percentile = p => sorted[Math.floor((sorted.length - 1) * p)];
    const sum = weights.reduce((total, value) => total + value, 0);

    return {
        min: sorted[0],
        p50: percentile(0.5),
        p95: percentile(0.95),
        max: sorted[sorted.length - 1],
        avg: sum / weights.length,
    };
}

function connectedComponentsUndirected(edges) {
    const visited = new Uint8Array(edges.length);
    const reverse = Array.from({ length: edges.length }, () => []);

    edges.forEach((neighbors, fromIndex) => {
        for (const [toIndex] of neighbors) {
            reverse[toIndex].push(fromIndex);
        }
    });

    const sizes = [];
    for (let i = 0; i < edges.length; i++) {
        if (visited[i]) continue;

        let size = 0;
        const stack = [i];
        visited[i] = 1;

        while (stack.length > 0) {
            const node = stack.pop();
            size += 1;

            for (const [neighbor] of edges[node]) {
                if (!visited[neighbor]) {
                    visited[neighbor] = 1;
                    stack.push(neighbor);
                }
            }

            for (const neighbor of reverse[node]) {
                if (!visited[neighbor]) {
                    visited[neighbor] = 1;
                    stack.push(neighbor);
                }
            }
        }

        sizes.push(size);
    }

    sizes.sort((a, b) => b - a);
    return sizes;
}

function dijkstra(edges, start, goal) {
    const dist = new Float64Array(edges.length);
    const prev = new Int32Array(edges.length);
    const visited = new Uint8Array(edges.length);

    dist.fill(Infinity);
    prev.fill(-1);
    dist[start] = 0;

    const pq = new PriorityQueue();
    pq.enqueue({ node: start, priority: 0 });

    let visitedCount = 0;

    while (!pq.isEmpty) {
        const current = pq.dequeue();
        const currentNode = current.node;

        if (visited[currentNode]) continue;
        visited[currentNode] = 1;
        visitedCount += 1;

        if (currentNode === goal) break;

        for (const [neighbor, weight] of edges[currentNode]) {
            if (visited[neighbor]) continue;

            const nextDistance = dist[currentNode] + weight;
            if (nextDistance < dist[neighbor]) {
                dist[neighbor] = nextDistance;
                prev[neighbor] = currentNode;
                pq.enqueue({ node: neighbor, priority: nextDistance });
            }
        }
    }

    if (!Number.isFinite(dist[goal])) {
        return { reachable: false, visitedCount };
    }

    let hops = 0;
    let cursor = goal;
    while (cursor !== -1) {
        hops += 1;
        cursor = prev[cursor];
    }

    return {
        reachable: true,
        distanceKm: dist[goal],
        hops,
        visitedCount,
    };
}

function chooseSamplePairs(nodeCount) {
    return [
        [0, nodeCount - 1],
        [Math.floor(nodeCount * 0.1), Math.floor(nodeCount * 0.9)],
        [Math.floor(nodeCount * 0.25), Math.floor(nodeCount * 0.75)],
    ];
}

function main() {
    const nodesPath = process.argv[2] || "data/tokyo23-drive-nodes.json";
    const edgesPath = process.argv[3] || "data/tokyo23-drive-edges.json";
    const resolvedNodesPath = path.resolve(nodesPath);
    const resolvedEdgesPath = path.resolve(edgesPath);

    const nodes = readJson(resolvedNodesPath);
    const edges = readJson(resolvedEdgesPath);

    if (nodes.length !== edges.length) {
        throw new Error(`nodes length (${nodes.length}) does not match edges length (${edges.length})`);
    }

    const integrity = inspectIntegrity(nodes, edges);
    const edgeCount = integrity.weights.length;
    const bounds = getBounds(nodes);
    const components = connectedComponentsUndirected(edges);
    const weights = summarizeWeights(integrity.weights);
    const outDegreeMax = Math.max(...integrity.outDegree);
    const outDegreeAvg = integrity.outDegree.reduce((sum, degree) => sum + degree, 0) / integrity.outDegree.length;

    console.log("Graph Inspection");
    console.log(`Nodes: ${formatNumber(nodes.length)}`);
    console.log(`Edges: ${formatNumber(edgeCount)}`);
    console.log(`Bounds: lng ${bounds.lngMin}..${bounds.lngMax}, lat ${bounds.latMin}..${bounds.latMax}`);
    console.log("");
    console.log("Integrity");
    console.log(`Invalid nodes: ${integrity.invalidNodes.length}`);
    console.log(`Invalid edges: ${integrity.invalidEdges.length}`);
    console.log(`Invalid weights: ${integrity.invalidWeights.length}`);
    console.log(`Isolated nodes: ${integrity.isolatedNodes.length}`);
    console.log("");
    console.log("Connectivity");
    console.log(`Undirected components: ${components.length}`);
    console.log(`Largest component: ${formatNumber(components[0])} nodes`);
    console.log(`Second-largest component: ${formatNumber(components[1] || 0)} nodes`);
    console.log("");
    console.log("Edge Weights (km)");
    console.log(`min: ${weights.min}`);
    console.log(`p50: ${weights.p50}`);
    console.log(`p95: ${weights.p95}`);
    console.log(`max: ${weights.max}`);
    console.log(`avg: ${weights.avg}`);
    console.log("");
    console.log("Out Degree");
    console.log(`max: ${outDegreeMax}`);
    console.log(`avg: ${outDegreeAvg}`);
    console.log("");
    console.log("Sample Paths");
    for (const [start, goal] of chooseSamplePairs(nodes.length)) {
        const result = dijkstra(edges, start, goal);
        if (!result.reachable) {
            console.log(`${start} -> ${goal}: unreachable, visited ${formatNumber(result.visitedCount)} nodes`);
            continue;
        }

        console.log(
            `${start} -> ${goal}: ${result.distanceKm.toFixed(3)} km, ` +
            `${formatNumber(result.hops)} path nodes, visited ${formatNumber(result.visitedCount)} nodes`
        );
    }
}

main();
