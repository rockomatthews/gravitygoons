#!/usr/bin/env python3
"""Build a labeled contact sheet from a Gravity Goons render directory."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("render_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--assignments", type=Path, default=Path("traits/assignments.json"))
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--cell", type=int, default=512)
    parser.add_argument("--show-pose", action="store_true")
    options = parser.parse_args()

    tokens = {item["token_id"]: item for item in json.loads(options.assignments.read_text())["tokens"]}
    files = sorted(options.render_dir.glob("[0-9][0-9][0-9][0-9].png"))
    label_height = 118 if options.show_pose else 92
    rows = math.ceil(len(files) / options.columns)
    sheet = Image.new("RGB", (options.columns * options.cell, rows * (options.cell + label_height)), "#050609")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=20)
    small = ImageFont.load_default(size=15)

    for index, path in enumerate(files):
        token = tokens[int(path.stem)]
        x = (index % options.columns) * options.cell
        y = (index // options.columns) * (options.cell + label_height)
        with Image.open(path) as image:
            image = image.convert("RGB").resize((options.cell, options.cell), Image.Resampling.LANCZOS)
            sheet.paste(image, (x, y))
        draw.rectangle((x, y + options.cell, x + options.cell, y + options.cell + label_height), fill="#0c1118")
        draw.text((x + 16, y + options.cell + 13), f"#{token['token_id']:04d}  {token['species'].upper()}", fill="#edf8f6", font=font)
        draw.text((x + 16, y + options.cell + 49), f"{token['discipline']}  ·  {token['parody_brand']}", fill="#18f1dc", font=small)
        if options.show_pose:
            draw.text((x + 16, y + options.cell + 78), f"{token['pose']}  ·  {token['stance']}", fill="#f39a45", font=small)
    options.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(options.output, optimize=True)
    print(options.output)


if __name__ == "__main__":
    main()
