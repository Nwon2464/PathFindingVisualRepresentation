const NodeColor = "#FFA500";
const EdgeColor = "#00008B";


// Priority Queue Class using Min-Heap based on f(n) = g(n) + h(n)
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
            let left = 2 * index + 1;
            let right = 2 * index + 2;
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

// Haversine Distance Function
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function haversineDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
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

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
}

// Initialize Leaflet Map
const map = L.map('map').setView([35.672, 139.650], 10); // Adjust center and zoom as needed

// Load OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let nodes = [];
let edges = [];

// Function to reconstruct the path from the predecessor array
function reconstructPath(prev, endNode) {
    const path = [];
    let current = endNode;
    while (current !== null) {
        path.push(current);
        current = prev[current];
    }
    path.reverse(); // Reverse to get path from start to goal
    return path;
}

// Function to visualize the path
function visualizePath(path, nodes) {
    for (let i = 0; i < path.length - 1; i++) {
        L.polyline([
            [nodes[path[i]][1], nodes[path[i]][0]],
            [nodes[path[i + 1]][1], nodes[path[i + 1]][0]]
        ], { color: 'red', weight: 5 }).addTo(map);
    }
}
// flash and fading out poly line.
function flashAndFadeOutPolyline(polyline) {
    let opacity = 0;
    let flashing = true;

    const flashDuration = 200;  // Time in ms for flash to reach full opacity
    const fadeOutDuration = 2000;  // Time in ms for fade out
    const totalDuration = flashDuration + fadeOutDuration;

    const intervalTime = 50;  // Update interval in ms

    const flashStep = 1 / (flashDuration / intervalTime);  // Step for increasing opacity
    const fadeOutStep = 1 / (fadeOutDuration / intervalTime);  // Step for decreasing opacity

    const animation = setInterval(() => {
        if (flashing) {
            opacity += flashStep;
            if (opacity >= 1) {
                opacity = 1;
                flashing = false;  // Stop flashing, start fading out
            }
        } else {
            opacity -= fadeOutStep;
            if (opacity <= 0) {
                opacity = 0;
                clearInterval(animation);  // Stop the animation when fully faded out
            }
        }
        // Update the opacity of the polyline
        polyline.setStyle({ opacity: opacity });
    }, intervalTime);
}
// Asynchronous function to process A* and return the path
async function aStar(nodes, edges, startNodeIndex, goalNodeIndex, map) {
    const dist = new Array(nodes.length).fill(Infinity);
    dist[startNodeIndex] = 0;

    const prev = new Array(nodes.length).fill(null);

    const pq = new PriorityQueue();
    const h = haversineDistance(nodes[startNodeIndex], nodes[goalNodeIndex]);
    pq.enqueue({
        node: startNodeIndex,
        g: 0,
        h: h,
        f: h
    });

    const visited = new Set();

    // Function to visualize the current node being processed
    function highlightNode(nodeIndex, color = 'yellow') {
        L.circleMarker([nodes[nodeIndex][1], nodes[nodeIndex][0]], {
            radius: 8,
            color: color,
            fillColor: color,
            fillOpacity: 0.5
        }).addTo(map);
    }

    // Function to visualize the path once found
    function visualizePath(path, nodes) {
        for (let i = 0; i < path.length - 1; i++) {
            L.polyline([
                [nodes[path[i]][1], nodes[path[i]][0]],
                [nodes[path[i + 1]][1], nodes[path[i + 1]][0]]
            ], { color: 'red', weight: 5 }).addTo(map);
        }
    }

    // Function to reconstruct the path from the predecessor array
    function reconstructPath(prev, endNode) {
        const path = [];
        let current = endNode;
        while (current !== null) {
            path.push(current);
            current = prev[current];
        }
        path.reverse(); // Reverse to get path from start to goal
        return path;
    }

    // Asynchronous function to process A* step-by-step for visualization
    while (!pq.isEmpty()) {
        const current = pq.dequeue();
        const currentNode = current.node;

        // If the goal is reached, reconstruct and return the path
        if (currentNode === goalNodeIndex) {
            console.log('Goal reached!');
            const path = reconstructPath(prev, goalNodeIndex);
            visualizePath(path, nodes);
            return path;
        }

        // Skip if already visited
        if (visited.has(currentNode)) continue;
        visited.add(currentNode);

        // Highlight current node
        highlightNode(currentNode, NodeColor);

        // Explore neighbors
        for (let [neighbor, weight] of edges[currentNode]) {
            if (visited.has(neighbor)) continue;

            const tentative_g = dist[currentNode] + weight;
            if (tentative_g < dist[neighbor]) {
                dist[neighbor] = tentative_g;
                prev[neighbor] = currentNode;

                const h = haversineDistance(nodes[neighbor], nodes[goalNodeIndex]);
                const f = tentative_g + h;

                pq.enqueue({
                    node: neighbor,
                    g: tentative_g,
                    h: h,
                    f: f
                });

                // Visualize the edge being considered
                let strobingPolyline = L.polyline([
                    [nodes[currentNode][1], nodes[currentNode][0]],
                    [nodes[neighbor][1], nodes[neighbor][0]]
                ], { color: EdgeColor, weight: 1, opacity: 0 }).addTo(map);

                // Call the function to flash and fade out the polyline
                flashAndFadeOutPolyline(strobingPolyline);

            }
        }

        // Delay for visualization (adjust as needed)
        await delay(100);
    }

    console.log('No path found.');
    return null;
}

// Function to animate the marker along the path
async function animatePath(path, nodes, delayTime = 500, map) {
    // Initialize the moving marker at the start node
    let movingMarker = L.marker([nodes[path[0]][1], nodes[path[0]][0]], {
        icon: L.icon({
            iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        })
    }).addTo(map).bindPopup('Moving Agent').openPopup();

    for (let i = 0; i < path.length; i++) {
        const nodeIndex = path[i];
        const [lng, lat] = nodes[nodeIndex];
        movingMarker.setLatLng([lat, lng]).update();
        movingMarker.bindPopup(`Current Position: Node ${nodeIndex}`).openPopup();
        await delay(delayTime);
    }
    // After completing the path, reset to start
    const start = path[0];
    const [startLng, startLat] = nodes[start];
    movingMarker.setLatLng([startLat, startLng]).update();
    movingMarker.bindPopup('Moving Agent').openPopup();
    await delay(500); // Optional delay before restarting

}

// Utility function for delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to fetch nodes and edges from JSON files and initiate the process
async function fetchAndRun() {
    try {
        const dataResponse = await fetch('data.json');
        nodes = await dataResponse.json();

        const edgesResponse = await fetch('edges.json');
        edges = await edgesResponse.json();

        console.log('Nodes:', nodes);
        console.log('Edges:', edges);





        await delay(4000);
        // Define start and goal nodes
        const startNodeIndex = 0; // Start at index 0
        const goalNodeIndex = nodes.length - 1; // Goal at last index

        // Highlight start and goal nodes
        L.marker([nodes[startNodeIndex][1], nodes[startNodeIndex][0]], {
            icon: L.icon({
                iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            })
        }).addTo(map)
            .bindPopup('Start Node')
            .openPopup();

        L.marker([nodes[goalNodeIndex][1], nodes[goalNodeIndex][0]], {
            icon: L.icon({
                iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            })
        }).addTo(map)
            .bindPopup('Goal Node')
            .openPopup();

        // Run A* algorithm to find the path
        const path = await aStar(nodes, edges, startNodeIndex, goalNodeIndex, map);

        if (path) {
            // Animate the agent along the path
            await animatePath(path, nodes, 500, map); // 500ms delay between steps
        } else {
            alert('No path found!');
        }

    } catch (error) {
        console.error('Error fetching JSON files:', error);
    }
}

// Initiate the process on page load
window.onload = fetchAndRun;