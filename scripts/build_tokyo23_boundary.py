#!/usr/bin/env python3

from pathlib import Path

import geopandas as gpd
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


def main():
    ox.settings.use_cache = True
    ox.settings.log_console = True

    boundary = ox.geocode_to_gdf(TOKYO_23_WARDS).union_all()
    boundary_gdf = gpd.GeoDataFrame(
        [{"name": "Tokyo 23 Wards", "geometry": boundary}],
        crs="EPSG:4326",
    )

    output_path = Path("data/tokyo23-wards-boundary.geojson")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    boundary_gdf.to_file(output_path, driver="GeoJSON")
    print(output_path)


if __name__ == "__main__":
    main()
