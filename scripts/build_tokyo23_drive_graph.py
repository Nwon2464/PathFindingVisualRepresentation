#!/usr/bin/env python3
"""
Build an app-friendly driving graph for Tokyo's 23 special wards from OpenStreetMap.

Outputs:
  data/tokyo23-drive-nodes.json
  data/tokyo23-drive-edges.json
  data/tokyo23-drive-meta.json

The app JSON shape intentionally matches the current frontend prototype:
  nodes: [[lng, lat], ...]
  edges: [[[neighborIndex, distanceKm], ...], ...]
"""

import argparse
import json
from pathlib import Path

import osmnx as ox


TOKYO_23_WARDS = [
    "Chiyoda-ku, Tokyo, Japan",
    "Chuo-ku, Tokyo, Japan",
    "Minato-ku, Tokyo, Japan",
    "Shinjuku-ku, Tokyo, Japan",
    "Bunkyo-ku, Tokyo, Japan",
    "Taito-ku, Tokyo, Japan",
    "Sumida-ku, Tokyo, Japan",
    "Koto-ku, Tokyo, Japan",
    "Shinagawa-ku, Tokyo, Japan",
    "Meguro-ku, Tokyo, Japan",
    "Ota-ku, Tokyo, Japan",
    "Setagaya-ku, Tokyo, Japan",
    "Shibuya-ku, Tokyo, Japan",
    "Nakano-ku, Tokyo, Japan",
    "Suginami-ku, Tokyo, Japan",
    "Toshima-ku, Tokyo, Japan",
    "Kita-ku, Tokyo, Japan",
    "Arakawa-ku, Tokyo, Japan",
    "Itabashi-ku, Tokyo, Japan",
    "Nerima-ku, Tokyo, Japan",
    "Adachi-ku, Tokyo, Japan",
    "Katsushika-ku, Tokyo, Japan",
    "Edogawa-ku, Tokyo, Japan",
]


def build_graph(place_queries):
    ox.settings.use_cache = True
    ox.settings.log_console = True

    return ox.graph_from_place(
        place_queries,
        network_type="drive",
        simplify=True,
        retain_all=False,
    )


def export_app_json(graph, output_dir, prefix):
    output_dir.mkdir(parents=True, exist_ok=True)

    nodes_gdf, edges_gdf = ox.graph_to_gdfs(graph)
    osmid_to_index = {}
    app_nodes = []

    for index, (osmid, row) in enumerate(nodes_gdf.iterrows()):
        osmid_to_index[osmid] = index
        app_nodes.append([row["x"], row["y"]])

    app_edges = [[] for _ in app_nodes]

    for (u, v, _key), row in edges_gdf.iterrows():
        from_index = osmid_to_index[u]
        to_index = osmid_to_index[v]
        distance_km = float(row["length"]) / 1000
        app_edges[from_index].append([to_index, distance_km])

    nodes_path = output_dir / f"{prefix}-nodes.json"
    edges_path = output_dir / f"{prefix}-edges.json"
    meta_path = output_dir / f"{prefix}-meta.json"

    nodes_path.write_text(json.dumps(app_nodes, separators=(",", ":")), encoding="utf-8")
    edges_path.write_text(json.dumps(app_edges, separators=(",", ":")), encoding="utf-8")

    edge_count = sum(len(neighbors) for neighbors in app_edges)
    weights = [weight for neighbors in app_edges for _, weight in neighbors]
    lngs = [lng for lng, _ in app_nodes]
    lats = [lat for _, lat in app_nodes]
    meta = {
        "source": "OpenStreetMap via OSMnx",
        "networkType": "drive",
        "directed": True,
        "nodes": len(app_nodes),
        "edges": edge_count,
        "bounds": {
            "lngMin": min(lngs),
            "lngMax": max(lngs),
            "latMin": min(lats),
            "latMax": max(lats),
        },
        "edgeWeightKm": {
            "min": min(weights),
            "max": max(weights),
            "avg": sum(weights) / len(weights),
        },
        "files": {
            "nodes": str(nodes_path),
            "edges": str(edges_path),
        },
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return meta


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="data")
    parser.add_argument("--prefix", default="tokyo23-drive")
    parser.add_argument(
        "--quick-tokyo",
        action="store_true",
        help="Use the broader 'Tokyo, Japan' place query for faster smoke testing.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    place_queries = "Tokyo, Japan" if args.quick_tokyo else TOKYO_23_WARDS
    graph = build_graph(place_queries)
    meta = export_app_json(graph, Path(args.output_dir), args.prefix)

    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
