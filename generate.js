const fs = require("fs");

const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');

const boundingBoxGeoJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [140.05281310856748, 35.50252108355032],
                        [140.13439096999298, 35.56536155999429],
                        [139.97231592049127, 35.689092229892594],
                        [139.88305627823382, 35.63080680884585],
                        [139.715485273107, 35.50296181405497],
                        [139.38157813322243, 35.59796537314969],
                        [139.3953971190411, 35.94772043392521],
                        [139.81430132741332, 36.07817293842645],
                        [140.19017715489196, 36.055728930007035],
                        [140.47263821012405, 35.91199422795893],
                        [140.46745766029392, 35.635359583058616],
                        [140.25174467070184, 35.46919683940304],
                        [140.04743139732477, 35.50082971849962],
                        [140.05281310856748, 35.50252108355032]  // Closing the loop
                    ]
                ]
            }
        }
    ]
};



function findMinMaxLngLat() {
    let polygonCoords = boundingBoxGeoJSON.features[0].geometry.coordinates;
    let minLat = polygonCoords[0][1];
    let maxLat = polygonCoords[0][1];
    let minLng = polygonCoords[0][0];
    let maxLng = polygonCoords[0][0];

    // Loop through each coordinate to find the min/max lat/lng
    for (let i = 1; i < polygonCoords.length; i++) {
        const lng = polygonCoords[i][0];
        const lat = polygonCoords[i][1];

        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }
    return [minLat, maxLat, minLng, maxLng];
    // console.log(`minLat: ${minLat}, maxLat: ${maxLat}, minLng: ${minLng}, maxLng: ${maxLng}`);
}


// Function to generate random coordinates within the bounding box
function generateRandomCoordinates() {
    const minLat = 35.38599715055747;
    const maxLat = 35.88401184239166;
    const minLng = 139.39303227522544;
    const maxLng = 140.4994525969376;

    let isLand = false;
    let randomPoint;


    let st = new Set();

    // Continue generating random points until one is inside the polygon
    while (!isLand) {
        const lat = Math.random() * (maxLat - minLat) + minLat;
        const lng = Math.random() * (maxLng - minLng) + minLng;

        randomPoint = [lng, lat]; // Return [longitude, latitude] for GeoJSON

        // Check if the generated point is inside the polygon
        const points = point(randomPoint);
        console.log(points);
        isLand = booleanPointInPolygon(points, boundingBoxGeoJSON.features[0]);

        let x = points.geometry.coordinates[0], y = points.geometry.coordinates[1];
        let pair = `${x},${y}`;
        //duplicates are not allowed 
        if (isLand == true) {
            if (st.has(pair)) {
                isLand = false;
                continue;
            }
            st.add(pair);
        }
    }

    return randomPoint; // Return the valid point inside the polygon
}

// Generate data
const data = [];
const start = [139.7798, 35.5494];  // Haneda Airport
// const start = [139.4305, 35.8820];
const end = [140.3929, 35.7720];    // Narita Airport
data.push(start);

for (let i = 0; i < 1000; i++) {
    const randomPoint = generateRandomCoordinates();
    data.push(randomPoint);
}

data.push(end);


const maxDistance = 10;
const edges = Array.from({ length: data.length }, () => []);
for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data.length; j++) {
        if (i == j) continue;
        const distance = haversineDistance(data[i], data[j]);
        if (distance <= maxDistance) {
            edges[i].push([j, distance]);
            edges[j].push([i, distance]);
        }
    }
}

// Write the data to a JSON file
fs.writeFile('data.json', JSON.stringify(data, null, 2), (err) => {
    if (err) throw err;
    console.log('Data saved to data.json');
});

fs.writeFile('edges.json', JSON.stringify(edges, null, 2), (err) => {
    if (err) throw err;
    console.log("data saved in edges.json");
})



function haversineDistance(coords1, coords2) {
    const R = 6371.0088; // Use the same radius as Turf.js (in kilometers)

    const lat1 = toRadians(coords1[0]);
    const lon1 = toRadians(coords1[1]);
    const lat2 = toRadians(coords2[0]);
    const lon2 = toRadians(coords2[1]);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in kilometers

    return distance;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}
