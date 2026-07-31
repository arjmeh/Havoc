"""Validate transparent exports and build a compact review contact sheet."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import (
    Image,
    ImageChops,
    ImageDraw,
    ImageFilter,
    ImageFont,
    ImageOps,
    ImageStat,
)


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIR = ROOT / "public" / "calibration-models"
RENDER_DIR = ROOT / "source-assets" / "calibration-3d" / "renders"
PREVIEW_DIR = ROOT / "docs" / "screenshots" / "calibration-3d-assets"
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

SPRITE_STEMS = (
    "glass-tumbler-front.png",
    "glass-tumbler-three-quarter.png",
    "glass-tumbler-top.png",
    "ice-face-cube-shell-front.png",
    "ice-face-cube-shell-three-quarter.png",
    "ice-cube-field.png",
)
MODELS = (
    "glass-tumbler.glb",
    "ice-face-cube-shell.glb",
    "ice-cube-field.glb",
)


def validate_sprite(path: Path) -> dict[str, object]:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        alpha = image.getchannel("A")
        bounds = alpha.getbbox()
        if image.size != (768, 768):
            raise ValueError(f"{path.name}: expected 768×768, got {image.size}")
        if bounds is None:
            raise ValueError(f"{path.name}: alpha is completely empty")
        alpha_min, alpha_max = alpha.getextrema()
        if alpha_min != 0:
            raise ValueError(f"{path.name}: background is not transparent")
        if alpha_max < 180:
            raise ValueError(f"{path.name}: object never reaches readable opacity")
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        if width < 260 or height < 260:
            raise ValueError(f"{path.name}: visible object bounds are unexpectedly small")
        return {
            "file": path.name,
            "dimensions": list(image.size),
            "alphaRange": [alpha_min, alpha_max],
            "visibleBounds": list(bounds),
            "bytes": path.stat().st_size,
        }


def export_webp(png_path: Path) -> Path:
    output = PUBLIC_DIR / f"{png_path.stem}.webp"
    with Image.open(png_path) as source:
        source.convert("RGBA").save(
            output,
            "WEBP",
            quality=92,
            method=6,
            exact=True,
        )
    return output


def validate_glb(path: Path) -> dict[str, object]:
    payload = path.read_bytes()
    if len(payload) < 1024:
        raise ValueError(f"{path.name}: model is unexpectedly small")
    if payload[:4] != b"glTF":
        raise ValueError(f"{path.name}: invalid GLB magic")
    if len(payload) > 5_000_000:
        raise ValueError(f"{path.name}: model exceeds the 5 MB asset budget")
    return {"file": path.name, "bytes": len(payload), "magic": "glTF"}


def checker(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGB", size, "#fffaf1")
    draw = ImageDraw.Draw(image)
    tile = 28
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile, y + tile), fill="#ebe8ef")
    return image


def create_contact_sheet() -> Path:
    tile_size = 360
    label_height = 46
    sheet = Image.new("RGB", (tile_size * 3, (tile_size + label_height) * 2), "#111015")
    font = ImageFont.load_default(size=18)

    for index, filename in enumerate(SPRITE_STEMS):
        with Image.open(RENDER_DIR / filename) as source:
            image = source.convert("RGBA")
            image.thumbnail((tile_size - 24, tile_size - 24), Image.Resampling.LANCZOS)
            background = checker((tile_size, tile_size)).convert("RGBA")
            x = (tile_size - image.width) // 2
            y = (tile_size - image.height) // 2
            background.alpha_composite(image, (x, y))
            column = index % 3
            row = index // 3
            offset_y = row * (tile_size + label_height)
            sheet.paste(background.convert("RGB"), (column * tile_size, offset_y))
            draw = ImageDraw.Draw(sheet)
            label = filename.removesuffix(".png").replace("-", " ")
            draw.text(
                (column * tile_size + 14, offset_y + tile_size + 12),
                label,
                font=font,
                fill="#ffffff",
            )

    output = PREVIEW_DIR / "havoc-calibration-3d-kit-contact-sheet.jpg"
    sheet.save(output, "JPEG", quality=92, optimize=True, progressive=True)
    return output


def create_face_cube_composite() -> Path:
    canvas = Image.new("RGBA", (768, 768), "#fffaf1")
    portrait_path = ROOT / "public" / "havoc-calibration-freeze.jpg"
    with Image.open(portrait_path) as source:
        portrait = ImageOps.fit(
            source.convert("RGB"),
            (328, 328),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.38),
        ).convert("RGBA")
    tint = Image.new("RGBA", portrait.size, (53, 223, 244, 34))
    portrait = Image.alpha_composite(portrait, tint)
    canvas.alpha_composite(portrait, (220, 220))

    with Image.open(RENDER_DIR / "ice-face-cube-shell-front.png") as shell_source:
        shell = shell_source.convert("RGBA")
        canvas.alpha_composite(shell)

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (188, 626, 580, 696),
        radius=35,
        fill=(17, 16, 21, 238),
    )
    font = ImageFont.load_default(size=22)
    draw.text(
        (384, 661),
        "captured face / 61% shell width",
        anchor="mm",
        fill="#ffffff",
        font=font,
    )

    output = PREVIEW_DIR / "havoc-face-cube-composite.jpg"
    canvas.convert("RGB").save(
        output, "JPEG", quality=94, optimize=True, progressive=True
    )
    return output


def create_glass_field_concept() -> Path:
    width, height = 1200, 800
    canvas = Image.new("RGBA", (width, height), "#fffaf1")
    draw = ImageDraw.Draw(canvas)
    top = (248, 245, 255)
    bottom = (224, 244, 247)
    for y in range(height):
        mix = y / max(1, height - 1)
        color = tuple(
            round(top[channel] * (1 - mix) + bottom[channel] * mix)
            for channel in range(3)
        )
        draw.line((0, y, width, y), fill=color + (255,))

    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (320, -230, 880, 330),
        fill=(112, 72, 255, 42),
    )
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(70)))

    with Image.open(RENDER_DIR / "glass-tumbler-three-quarter.png") as source:
        glass_master = source.convert("RGBA")

    colors = (
        (112, 72, 255, 210),
        (255, 79, 98, 210),
        (53, 223, 244, 210),
        (200, 255, 55, 210),
        (255, 174, 52, 210),
        (232, 86, 255, 210),
    )
    rows = 8
    for row in range(rows):
        depth = row / (rows - 1)
        glass_height = round(48 + (depth**1.65) * 210)
        glass_width = round(glass_height * 0.92)
        center_y = round(146 + (depth**1.65) * 535)
        spacing = round(53 + depth * 118)
        count = max(7, math.ceil(width / spacing) + 2)
        row_shift = spacing // 2 if row % 2 else 0
        for column in range(-count // 2, count // 2 + 1):
            center_x = width // 2 + column * spacing + row_shift
            if center_x < -glass_width or center_x > width + glass_width:
                continue
            left = center_x - glass_width // 2
            top_y = center_y - glass_height

            shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow)
            shadow_draw.ellipse(
                (
                    left + round(glass_width * 0.14),
                    center_y - round(glass_height * 0.08),
                    left + round(glass_width * 0.92),
                    center_y + round(glass_height * 0.08),
                ),
                fill=(17, 16, 21, round(18 + depth * 30)),
            )
            canvas = Image.alpha_composite(
                canvas, shadow.filter(ImageFilter.GaussianBlur(max(1, glass_height // 18)))
            )

            liquid = Image.new("RGBA", (glass_width, glass_height), (0, 0, 0, 0))
            liquid_draw = ImageDraw.Draw(liquid)
            fill_top = round(glass_height * (0.53 + ((row + column) % 3) * 0.055))
            liquid_color = colors[(row * 3 + column) % len(colors)]
            liquid_draw.polygon(
                (
                    (round(glass_width * 0.25), fill_top),
                    (round(glass_width * 0.76), fill_top),
                    (round(glass_width * 0.69), round(glass_height * 0.86)),
                    (round(glass_width * 0.30), round(glass_height * 0.86)),
                ),
                fill=liquid_color,
            )
            liquid_draw.ellipse(
                (
                    round(glass_width * 0.25),
                    fill_top - max(1, glass_height // 28),
                    round(glass_width * 0.76),
                    fill_top + max(2, glass_height // 28),
                ),
                fill=(
                    min(255, liquid_color[0] + 28),
                    min(255, liquid_color[1] + 28),
                    min(255, liquid_color[2] + 28),
                    liquid_color[3],
                ),
            )
            canvas.alpha_composite(liquid, (left, top_y))

            glass = glass_master.resize(
                (glass_width, glass_height), Image.Resampling.LANCZOS
            )
            canvas.alpha_composite(glass, (left, top_y))

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rounded_rectangle(
        (330, 719, 870, 778), radius=30, fill=(17, 16, 21, 224)
    )
    font = ImageFont.load_default(size=20)
    overlay_draw.text(
        (600, 748),
        "camera pullback / one glass becomes a world",
        anchor="mm",
        fill="#ffffff",
        font=font,
    )
    canvas = Image.alpha_composite(canvas, overlay)

    output = PREVIEW_DIR / "havoc-infinite-glass-field-concept.jpg"
    canvas.convert("RGB").save(
        output, "JPEG", quality=93, optimize=True, progressive=True
    )
    return output


def main() -> None:
    sprite_results = [
        validate_sprite(RENDER_DIR / name) for name in SPRITE_STEMS
    ]
    webp_results = []
    for name in SPRITE_STEMS:
        output = export_webp(RENDER_DIR / name)
        with Image.open(RENDER_DIR / name) as master_source, Image.open(output) as image:
            if image.size != (768, 768) or "A" not in image.getbands():
                raise ValueError(f"{output.name}: invalid runtime WebP")
            master = master_source.convert("RGBA")
            decoded = image.convert("RGBA")
            if ImageChops.difference(
                master.getchannel("A"), decoded.getchannel("A")
            ).getbbox():
                raise ValueError(f"{output.name}: WebP alpha drifted from PNG master")
            mean_color_difference = max(
                ImageStat.Stat(ImageChops.difference(master, decoded)).mean[:3]
            )
            if mean_color_difference > 2.5:
                raise ValueError(
                    f"{output.name}: color compression delta is too large"
                )
        webp_results.append(
            {
                "file": output.name,
                "bytes": output.stat().st_size,
                "maxMeanChannelDelta": round(mean_color_difference, 3),
            }
        )
    model_results = [validate_glb(PUBLIC_DIR / name) for name in MODELS]
    contact_sheet = create_contact_sheet()
    face_cube_composite = create_face_cube_composite()
    glass_field_concept = create_glass_field_concept()
    report = {
        "pngMasters": sprite_results,
        "runtimeWebP": webp_results,
        "models": model_results,
        "contactSheet": str(contact_sheet.relative_to(ROOT)),
        "faceCubeComposite": str(face_cube_composite.relative_to(ROOT)),
        "glassFieldConcept": str(glass_field_concept.relative_to(ROOT)),
    }
    report_path = PREVIEW_DIR / "validation-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
