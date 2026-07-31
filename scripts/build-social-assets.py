#!/usr/bin/env python3
"""Build Havoc's no-cost onboarding social assets.

This script owns two independent, reproducible pipelines:

1. Render the Unicode Emoji 17.0 face catalog and twelve original exclusive
   variants with local Pillow drawing primitives.
2. Decode the product-owner supplied friends animation with FFmpeg, crop the
   watermark before chroma removal, and export a transparent muted WebP loop
   plus a reduced-motion still.

Normal Next.js builds consume committed output and do not run this script.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from typing import Iterable, Sequence

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat


ROOT = Path(__file__).resolve().parents[1]
SOURCE_AVATARS = ROOT / "source-assets" / "avatars"
SOURCE_SOCIAL = ROOT / "source-assets" / "social"
PUBLIC_AVATARS = ROOT / "public" / "havoc-avatars"
PUBLIC_FULL = PUBLIC_AVATARS / "full"
PUBLIC_THUMB = PUBLIC_AVATARS / "thumb"
APP_MANIFEST = ROOT / "app" / "avatar-catalog.ts"

UNICODE_CATALOG = SOURCE_AVATARS / "unicode-face-catalog-17.0.tsv"
EXCLUSIVE_CATALOG = SOURCE_AVATARS / "exclusive-avatar-catalog.tsv"
DEFAULT_VIDEO_SOURCE = SOURCE_SOCIAL / "kling_20260731_VIDEO_Animate_al_1496_0.mp4"

ANIMATED_SOCIAL = ROOT / "public" / "havoc-friends-trio.webp"
STILL_SOCIAL = ROOT / "public" / "havoc-friends-trio-still.webp"
SOCIAL_METADATA = ROOT / "public" / "havoc-friends-trio.json"
AVATAR_METADATA = PUBLIC_AVATARS / "catalog.json"
AVATAR_ATLAS = PUBLIC_AVATARS / "havoc-avatar-atlas.webp"
AVATAR_LOCK = PUBLIC_AVATARS / "havoc-avatar-lock.webp"

UNICODE_VERSION = "17.0"
EXPECTED_UNICODE_COUNT = 119
EXPECTED_EXCLUSIVE_COUNT = 12
EXPECTED_GROUP_COUNTS = {
    "face-smiling": 14,
    "face-affection": 9,
    "face-tongue": 6,
    "face-hand": 7,
    "face-neutral-skeptical": 16,
    "face-sleepy": 6,
    "face-unwell": 12,
    "face-hat": 3,
    "face-glasses": 3,
    "face-concerned": 27,
    "face-negative": 8,
    "face-costume": 8,
}

FULL_SIZE = 256
THUMB_SIZE = 96
ATLAS_COLUMNS = 12
SUPERSAMPLE = 3
WEBP_METHOD = 4

SOCIAL_WIDTH = 520
SOCIAL_HEIGHT = 300
SOCIAL_FPS = 24
SOCIAL_CROP = {"x": 0, "y": 10, "width": 1292, "height": 640}
SOCIAL_KEY_COLOR = "0x00FE04"
SOCIAL_WATERMARK_SAFE_Y = 650

INK = "#170E25"
WHITE = "#FFF9EA"
PAPER = "#F6F1E8"
VIOLET = "#7C3AED"
CORAL = "#FF5D6C"
CYAN = "#2EE7D1"
LIME = "#C7FF32"
YELLOW = "#FFD338"
PINK = "#FF79B0"
RED = "#D82E4C"
BROWN = "#6E351F"


@dataclass(frozen=True)
class AvatarDefinition:
    id: str
    unicode_reference: str
    unicode_codepoints: tuple[str, ...]
    name: str
    group: str
    tier: str
    treatment: str = ""


@dataclass(frozen=True)
class Palette:
    light: str
    mid: str
    dark: str
    accent: str


PALETTES = {
    "gold": Palette("#FFF38A", "#F4CB3C", "#D98B18", VIOLET),
    "warm": Palette("#FFE39A", "#F6BA3C", "#E36B2D", CORAL),
    "coral": Palette("#FF9C9F", "#FF5D6C", "#B91E4C", YELLOW),
    "violet": Palette("#D2A5FF", "#8C4AF0", "#4B1A91", CYAN),
    "cyan": Palette("#A6FFF3", "#38D8CE", "#147C98", VIOLET),
    "lime": Palette("#E8FF88", "#B8EC35", "#5C9C29", VIOLET),
    "ice": Palette("#E6FBFF", "#8BDDF4", "#3A79B8", VIOLET),
    "bone": Palette("#FFFDE8", "#E9DFC3", "#9E8E7A", VIOLET),
    "brown": Palette("#F3A962", "#A85A32", "#5B251E", PINK),
    "chrome": Palette("#FFFFFF", "#B9C5D2", "#58677C", VIOLET),
    "midnight": Palette("#7164A8", "#292447", "#0B0911", CYAN),
    "holo": Palette("#FFD4F7", "#7CDDF2", "#7C3AED", LIME),
}


def box(values: Sequence[float]) -> tuple[int, ...]:
    return tuple(round(value * SUPERSAMPLE) for value in values)


def points(values: Iterable[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(round(x * SUPERSAMPLE), round(y * SUPERSAMPLE)) for x, y in values]


def width(value: float) -> int:
    return max(1, round(value * SUPERSAMPLE))


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    return (*hex_rgb(value), alpha)


def mix(left: str, right: str, amount: float) -> tuple[int, int, int, int]:
    one = hex_rgb(left)
    two = hex_rgb(right)
    return (
        round(one[0] + (two[0] - one[0]) * amount),
        round(one[1] + (two[1] - one[1]) * amount),
        round(one[2] + (two[2] - one[2]) * amount),
        255,
    )


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not value:
        raise ValueError("Avatar id cannot be empty")
    return value


def parse_catalogs() -> list[AvatarDefinition]:
    definitions: list[AvatarDefinition] = []
    group_counts: dict[str, int] = {}

    for raw_line in UNICODE_CATALOG.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = raw_line.split("\t")
        if len(parts) != 4:
            raise ValueError(f"Malformed Unicode catalog line: {raw_line!r}")
        group, codepoints, glyph, name = parts
        definition = AvatarDefinition(
            id=slugify(name),
            unicode_reference=glyph,
            unicode_codepoints=tuple(codepoints.split()),
            name=name,
            group=group,
            tier="standard",
        )
        definitions.append(definition)
        group_counts[group] = group_counts.get(group, 0) + 1

    if len(definitions) != EXPECTED_UNICODE_COUNT:
        raise ValueError(
            f"Expected {EXPECTED_UNICODE_COUNT} Unicode faces, found {len(definitions)}"
        )
    if group_counts != EXPECTED_GROUP_COUNTS:
        raise ValueError(
            "Unicode subgroup coverage drifted:\n"
            f"expected {EXPECTED_GROUP_COUNTS}\n"
            f"actual   {group_counts}"
        )

    for raw_line in EXCLUSIVE_CATALOG.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = raw_line.split("\t")
        if len(parts) != 3:
            raise ValueError(f"Malformed exclusive catalog line: {raw_line!r}")
        avatar_id, name, treatment = parts
        definitions.append(
            AvatarDefinition(
                id=f"exclusive-{slugify(avatar_id)}",
                unicode_reference="",
                unicode_codepoints=(),
                name=name,
                group="exclusive-original",
                tier="exclusive",
                treatment=treatment,
            )
        )

    exclusive_count = sum(item.tier == "exclusive" for item in definitions)
    if exclusive_count != EXPECTED_EXCLUSIVE_COUNT:
        raise ValueError(
            f"Expected {EXPECTED_EXCLUSIVE_COUNT} exclusives, found {exclusive_count}"
        )

    ids = [item.id for item in definitions]
    if len(ids) != len(set(ids)):
        duplicates = sorted({avatar_id for avatar_id in ids if ids.count(avatar_id) > 1})
        raise ValueError(f"Duplicate avatar ids: {duplicates}")

    return definitions


def palette_name_for(item: AvatarDefinition) -> str:
    name = item.name
    if item.tier == "exclusive":
        exclusive_palettes = {
            "exclusive-crowned-chaos": "violet",
            "exclusive-liquid-gold": "gold",
            "exclusive-jeweled-gaze": "midnight",
            "exclusive-electric-pulse": "cyan",
            "exclusive-fire-eyes": "coral",
            "exclusive-chrome-mischief": "chrome",
            "exclusive-cosmic-spiral": "midnight",
            "exclusive-holographic-wink": "holo",
            "exclusive-diamond-grin": "ice",
            "exclusive-void-halo": "midnight",
            "exclusive-neon-venom": "lime",
            "exclusive-royal-freeze": "ice",
        }
        return exclusive_palettes[item.id]
    if name in {"enraged face", "angry face", "face with symbols on mouth", "hot face"}:
        return "coral"
    if name in {"cold face", "face with medical mask", "face with thermometer"}:
        return "ice"
    if name in {"nauseated face", "face vomiting"}:
        return "lime"
    if "horns" in name or name in {"ogre", "goblin"}:
        return "violet"
    if name in {"skull", "skull and crossbones", "ghost"}:
        return "bone"
    if name == "pile of poo":
        return "brown"
    if name in {"alien", "alien monster"}:
        return "cyan"
    if name == "robot":
        return "chrome"
    if name in {"flushed face", "face screaming in fear"}:
        return "warm"
    return "gold"


def draw_sphere(canvas: Image.Image, palette: Palette, *, square: bool = False) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shape = box((24, 31, 236, 241) if not square else (27, 36, 233, 236))
    shadow_draw.ellipse(shape, fill=rgba(INK, 92))
    shadow = shadow.filter(ImageFilter.GaussianBlur(width(8)))
    canvas.alpha_composite(shadow)

    face = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    face_draw = ImageDraw.Draw(face)
    outer = box((17, 16, 239, 238))
    inner = box((23, 21, 233, 232))
    if square:
        face_draw.rounded_rectangle(outer, radius=width(48), fill=rgba(INK))
    else:
        face_draw.ellipse(outer, fill=rgba(INK))

    gradient_size = (inner[2] - inner[0], inner[3] - inner[1])
    radial = Image.radial_gradient("L").resize(gradient_size, Image.Resampling.BICUBIC)
    light = Image.new("RGBA", gradient_size, rgba(palette.light))
    dark = Image.new("RGBA", gradient_size, rgba(palette.dark))
    gradient = Image.composite(dark, light, radial)
    mid_overlay = Image.new("RGBA", gradient_size, rgba(palette.mid, 82))
    gradient = Image.alpha_composite(gradient, mid_overlay)
    mask = Image.new("L", gradient_size, 0)
    mask_draw = ImageDraw.Draw(mask)
    if square:
        mask_draw.rounded_rectangle((0, 0, gradient_size[0], gradient_size[1]), radius=width(43), fill=255)
    else:
        mask_draw.ellipse((0, 0, gradient_size[0], gradient_size[1]), fill=255)
    face.paste(gradient, (inner[0], inner[1]), mask)

    highlight = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.ellipse(box((48, 35, 145, 91)), fill=(255, 255, 255, 88))
    highlight = highlight.filter(ImageFilter.GaussianBlur(width(10)))
    face.alpha_composite(highlight)

    lower = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    lower_draw = ImageDraw.Draw(lower)
    lower_draw.ellipse(box((65, 173, 218, 231)), fill=rgba(palette.dark, 54))
    lower = lower.filter(ImageFilter.GaussianBlur(width(12)))
    face.alpha_composite(lower)
    canvas.alpha_composite(face)


def regular_star(
    center_x: float,
    center_y: float,
    outer: float,
    inner: float,
    count: int = 5,
    rotation: float = -math.pi / 2,
) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    for index in range(count * 2):
        radius = outer if index % 2 == 0 else inner
        angle = rotation + math.pi * index / count
        result.append(
            (center_x + math.cos(angle) * radius, center_y + math.sin(angle) * radius)
        )
    return result


def draw_heart(draw: ImageDraw.ImageDraw, center_x: float, center_y: float, size: float, color: str) -> None:
    draw.ellipse(box((center_x - size, center_y - size * 0.65, center_x, center_y + size * 0.35)), fill=rgba(color))
    draw.ellipse(box((center_x, center_y - size * 0.65, center_x + size, center_y + size * 0.35)), fill=rgba(color))
    draw.polygon(
        points(
            [
                (center_x - size, center_y - size * 0.05),
                (center_x + size, center_y - size * 0.05),
                (center_x, center_y + size * 1.25),
            ]
        ),
        fill=rgba(color),
    )


def draw_drop(draw: ImageDraw.ImageDraw, x: float, y: float, size: float, color: str = CYAN) -> None:
    draw.ellipse(box((x - size * 0.62, y, x + size * 0.62, y + size * 1.35)), fill=rgba(INK))
    draw.polygon(points([(x, y - size * 0.8), (x - size * 0.58, y + size * 0.45), (x + size * 0.58, y + size * 0.45)]), fill=rgba(INK))
    inset = size * 0.18
    draw.ellipse(box((x - size * 0.45, y + inset, x + size * 0.45, y + size * 1.15)), fill=rgba(color))
    draw.polygon(points([(x, y - size * 0.48), (x - size * 0.39, y + size * 0.43), (x + size * 0.39, y + size * 0.43)]), fill=rgba(color))
    draw.ellipse(box((x - size * 0.2, y + size * 0.05, x + size * 0.02, y + size * 0.3)), fill=(255, 255, 255, 150))


def draw_open_eye(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    center_y: float,
    *,
    scale: float = 1.0,
    pupil_offset: tuple[float, float] = (0, 0),
    pupil_color: str = INK,
) -> None:
    outer = (center_x - 23 * scale, center_y - 28 * scale, center_x + 23 * scale, center_y + 28 * scale)
    inner = (center_x - 18 * scale, center_y - 23 * scale, center_x + 18 * scale, center_y + 23 * scale)
    draw.ellipse(box(outer), fill=rgba(INK))
    draw.ellipse(box(inner), fill=rgba(WHITE))
    pupil_x = center_x + pupil_offset[0] * scale
    pupil_y = center_y + pupil_offset[1] * scale
    draw.ellipse(box((pupil_x - 9 * scale, pupil_y - 13 * scale, pupil_x + 9 * scale, pupil_y + 13 * scale)), fill=rgba(pupil_color))
    draw.ellipse(box((pupil_x - 3 * scale, pupil_y - 8 * scale, pupil_x + 2 * scale, pupil_y - 3 * scale)), fill=rgba(WHITE))


def draw_eye(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    center_y: float,
    kind: str,
    side: str,
) -> None:
    direction = -1 if side == "left" else 1
    if kind in {"open", "wide", "small", "roll", "peeking"}:
        scale = {"wide": 1.14, "small": 0.82, "peeking": 0.68}.get(kind, 1.0)
        offset = (0, -10) if kind == "roll" else ((direction * 5, 0) if kind == "peeking" else (0, 0))
        draw_open_eye(draw, center_x, center_y, scale=scale, pupil_offset=offset)
    elif kind in {"closed", "sleepy", "wink"}:
        y_shift = 2 if kind == "sleepy" else 0
        draw.arc(
            box((center_x - 23, center_y - 10 + y_shift, center_x + 23, center_y + 20 + y_shift)),
            200,
            340,
            fill=rgba(INK),
            width=width(7),
        )
    elif kind == "squint":
        draw.line(points([(center_x - 19, center_y - 12), (center_x + 18, center_y + 12)]), fill=rgba(INK), width=width(7))
        draw.line(points([(center_x + 18, center_y - 12), (center_x - 19, center_y + 12)]), fill=rgba(INK), width=width(7))
    elif kind == "heart":
        draw_heart(draw, center_x, center_y - 2, 17, CORAL)
    elif kind == "star":
        draw.polygon(points(regular_star(center_x, center_y, 23, 10)), fill=rgba(YELLOW), outline=rgba(INK))
        draw.line(points(regular_star(center_x, center_y, 23, 10) + [regular_star(center_x, center_y, 23, 10)[0]]), fill=rgba(INK), width=width(3), joint="curve")
    elif kind == "cross":
        draw.line(points([(center_x - 18, center_y - 18), (center_x + 18, center_y + 18)]), fill=rgba(INK), width=width(8))
        draw.line(points([(center_x + 18, center_y - 18), (center_x - 18, center_y + 18)]), fill=rgba(INK), width=width(8))
    elif kind == "spiral":
        spiral: list[tuple[float, float]] = []
        for index in range(44):
            angle = index * 0.58
            radius = 1.3 + index * 0.42
            spiral.append((center_x + math.cos(angle) * radius, center_y + math.sin(angle) * radius))
        draw.line(points(spiral), fill=rgba(INK), width=width(4), joint="curve")
    elif kind == "money":
        draw.arc(box((center_x - 14, center_y - 20, center_x + 14, center_y + 1)), 70, 285, fill=rgba(INK), width=width(5))
        draw.arc(box((center_x - 14, center_y - 1, center_x + 14, center_y + 20)), 250, 105, fill=rgba(INK), width=width(5))
        draw.line(points([(center_x, center_y - 25), (center_x, center_y + 25)]), fill=rgba(INK), width=width(4))
    elif kind == "diamond":
        draw.polygon(points([(center_x, center_y - 22), (center_x + 20, center_y - 3), (center_x, center_y + 22), (center_x - 20, center_y - 3)]), fill=rgba(CYAN), outline=rgba(INK))
        draw.line(points([(center_x - 20, center_y - 3), (center_x + 20, center_y - 3), (center_x, center_y + 22), (center_x, center_y - 22), (center_x - 20, center_y - 3)]), fill=rgba(WHITE, 190), width=width(2))
    elif kind == "lightning":
        draw.polygon(points([(center_x + 3, center_y - 25), (center_x - 17, center_y + 2), (center_x - 3, center_y + 1), (center_x - 11, center_y + 26), (center_x + 20, center_y - 7), (center_x + 5, center_y - 5)]), fill=rgba(VIOLET), outline=rgba(INK))
    elif kind == "flame":
        draw.polygon(points([(center_x, center_y - 28), (center_x + 20, center_y - 2), (center_x + 13, center_y + 23), (center_x, center_y + 28), (center_x - 16, center_y + 18), (center_x - 18, center_y - 1), (center_x - 4, center_y - 16)]), fill=rgba(CORAL), outline=rgba(INK))
        draw.ellipse(box((center_x - 7, center_y - 1, center_x + 7, center_y + 18)), fill=rgba(YELLOW))
    else:
        raise ValueError(f"Unsupported eye kind: {kind}")


def draw_brows(draw: ImageDraw.ImageDraw, mood: str) -> None:
    if mood == "raised":
        draw.arc(box((56, 47, 109, 74)), 200, 340, fill=rgba(INK), width=width(6))
        draw.arc(box((147, 54, 202, 83)), 200, 340, fill=rgba(INK), width=width(6))
    elif mood == "angry":
        draw.line(points([(56, 62), (105, 78)]), fill=rgba(INK), width=width(8))
        draw.line(points([(151, 78), (201, 62)]), fill=rgba(INK), width=width(8))
    elif mood == "worried":
        draw.line(points([(57, 76), (104, 61)]), fill=rgba(INK), width=width(7))
        draw.line(points([(153, 61), (200, 76)]), fill=rgba(INK), width=width(7))
    elif mood == "skeptical":
        draw.line(points([(55, 69), (105, 58)]), fill=rgba(INK), width=width(7))
        draw.line(points([(153, 73), (201, 73)]), fill=rgba(INK), width=width(7))


def draw_mouth(draw: ImageDraw.ImageDraw, kind: str) -> None:
    if kind == "smile":
        draw.arc(box((73, 126, 183, 195)), 20, 160, fill=rgba(INK), width=width(8))
    elif kind == "smirk":
        draw.arc(box((92, 139, 190, 189)), 28, 155, fill=rgba(INK), width=width(8))
    elif kind == "frown":
        draw.arc(box((77, 154, 179, 210)), 200, 340, fill=rgba(INK), width=width(8))
    elif kind == "flat":
        draw.line(points([(83, 168), (173, 168)]), fill=rgba(INK), width=width(8))
    elif kind == "diagonal":
        draw.line(points([(85, 181), (174, 155)]), fill=rgba(INK), width=width(8))
    elif kind == "open":
        draw.ellipse(box((75, 133, 181, 208)), fill=rgba(INK))
        draw.ellipse(box((88, 148, 168, 198)), fill=rgba("#7C2446"))
        draw.rounded_rectangle(box((89, 142, 167, 161)), radius=width(7), fill=rgba(WHITE))
        draw.ellipse(box((100, 177, 158, 201)), fill=rgba(PINK))
    elif kind == "grin":
        draw.rounded_rectangle(box((72, 139, 184, 201)), radius=width(25), fill=rgba(INK))
        draw.rounded_rectangle(box((83, 147, 173, 178)), radius=width(12), fill=rgba(WHITE))
        for x in (105, 128, 151):
            draw.line(points([(x, 149), (x, 176)]), fill=rgba("#C8BFAE"), width=width(2))
        draw.arc(box((88, 166, 168, 198)), 12, 168, fill=rgba(PINK), width=width(6))
    elif kind == "grimace":
        draw.rounded_rectangle(box((76, 145, 180, 193)), radius=width(15), fill=rgba(INK))
        draw.rounded_rectangle(box((84, 152, 172, 186)), radius=width(10), fill=rgba(WHITE))
        for x in (102, 120, 138, 156):
            draw.line(points([(x, 153), (x, 185)]), fill=rgba("#B9AD99"), width=width(2))
        draw.line(points([(85, 169), (171, 169)]), fill=rgba("#B9AD99"), width=width(2))
    elif kind == "tongue":
        draw.ellipse(box((77, 132, 179, 196)), fill=rgba(INK))
        draw.ellipse(box((96, 163, 160, 220)), fill=rgba(PINK), outline=rgba(INK), width=width(4))
        draw.line(points([(128, 176), (128, 211)]), fill=rgba("#D94E82"), width=width(3))
    elif kind == "kiss":
        draw.ellipse(box((104, 150, 132, 176)), fill=rgba(CORAL))
        draw.ellipse(box((126, 150, 154, 176)), fill=rgba(CORAL))
        draw.line(points([(110, 164), (148, 164)]), fill=rgba(INK), width=width(3))
    elif kind == "oval":
        draw.ellipse(box((102, 140, 154, 203)), fill=rgba(INK))
        draw.ellipse(box((113, 151, 143, 191)), fill=rgba("#6A2240"))
    elif kind == "zipper":
        draw.line(points([(78, 166), (179, 166)]), fill=rgba(INK), width=width(6))
        for x in range(86, 176, 14):
            draw.line(points([(x, 157), (x + 8, 175)]), fill=rgba(WHITE), width=width(4))
        draw.rounded_rectangle(box((172, 151, 190, 181)), radius=width(4), fill=rgba(CYAN), outline=rgba(INK), width=width(3))
    elif kind == "yawn":
        draw.ellipse(box((82, 127, 174, 218)), fill=rgba(INK))
        draw.ellipse(box((96, 145, 160, 204)), fill=rgba("#682541"))
        draw.ellipse(box((105, 181, 151, 207)), fill=rgba(PINK))
    elif kind == "puke":
        draw.ellipse(box((83, 145, 173, 189)), fill=rgba(INK))
        draw.rounded_rectangle(box((101, 173, 155, 235)), radius=width(14), fill=rgba(LIME), outline=rgba(INK), width=width(4))
        draw.ellipse(box((108, 185, 124, 201)), fill=rgba(CYAN))
    elif kind == "censor":
        draw.rounded_rectangle(box((65, 146, 191, 190)), radius=width(10), fill=rgba(INK))
        draw.line(points([(81, 158), (96, 179), (106, 157), (116, 180)]), fill=rgba(CORAL), width=width(5))
        draw.ellipse(box((127, 157, 144, 174)), outline=rgba(CYAN), width=width(4))
        draw.polygon(points(regular_star(163, 168, 12, 5, count=6)), fill=rgba(YELLOW))
    elif kind == "fangs":
        draw.rounded_rectangle(box((73, 137, 183, 204)), radius=width(30), fill=rgba(INK))
        draw.polygon(points([(91, 145), (111, 145), (101, 177)]), fill=rgba(WHITE))
        draw.polygon(points([(145, 145), (165, 145), (155, 177)]), fill=rgba(WHITE))
        draw.ellipse(box((101, 178, 157, 205)), fill=rgba(CYAN))
    elif kind == "diamond":
        draw.polygon(points([(78, 157), (178, 143), (161, 196), (96, 205)]), fill=rgba(CYAN), outline=rgba(INK))
        draw.line(points([(96, 155), (111, 202), (132, 150), (148, 198), (165, 146)]), fill=rgba(WHITE, 190), width=width(3))
    elif kind == "none":
        return
    else:
        raise ValueError(f"Unsupported mouth kind: {kind}")


def expression_for(item: AvatarDefinition) -> tuple[str, str, str]:
    name = item.name
    if item.id == "exclusive-jeweled-gaze":
        return "diamond", "diamond", "raised"
    if item.id == "exclusive-electric-pulse":
        return "lightning", "grin", "raised"
    if item.id == "exclusive-fire-eyes":
        return "flame", "open", "angry"
    if item.id == "exclusive-cosmic-spiral":
        return "spiral", "smile", "raised"
    if item.id == "exclusive-holographic-wink":
        return "wink", "smile", "skeptical"
    if item.id == "exclusive-diamond-grin":
        return "diamond", "diamond", "raised"
    if item.id == "exclusive-void-halo":
        return "closed", "smile", "raised"
    if item.id == "exclusive-neon-venom":
        return "wide", "fangs", "angry"
    if item.id in {"exclusive-crowned-chaos", "exclusive-chrome-mischief", "exclusive-royal-freeze"}:
        return "wink", "smirk", "skeptical"
    if item.id == "exclusive-liquid-gold":
        return "closed", "smile", "raised"

    if "heart-eyes" in name:
        eye = "heart"
    elif name == "star-struck":
        eye = "star"
    elif "crossed-out eyes" in name:
        eye = "cross"
    elif "spiral eyes" in name:
        eye = "spiral"
    elif "rolling eyes" in name:
        eye = "roll"
    elif "money-mouth" in name:
        eye = "money"
    elif name in {"winking face", "winking face with tongue"}:
        eye = "wink"
    elif any(term in name for term in ("squinting", "confounded", "persevering")):
        eye = "squint"
    elif any(term in name for term in ("closed eyes", "smiling eyes", "relieved face", "pensive face", "sleepy face", "sleeping face")):
        eye = "closed"
    elif any(term in name for term in ("astonished", "fearful", "screaming", "open eyes", "pleading", "holding back tears", "distorted")):
        eye = "wide"
    elif "bags under eyes" in name:
        eye = "sleepy"
    elif name == "face with peeking eye":
        eye = "peeking"
    else:
        eye = "open"

    if name in {"face without mouth", "dotted line face", "face in clouds"}:
        mouth = "none"
    elif "symbols on mouth" in name:
        mouth = "censor"
    elif "zipper-mouth" in name:
        mouth = "zipper"
    elif "vomiting" in name:
        mouth = "puke"
    elif any(term in name for term in ("with tongue", "savoring food", "zany")):
        mouth = "tongue"
    elif "kissing" in name or "blowing a kiss" in name:
        mouth = "kiss"
    elif name == "yawning face":
        mouth = "yawn"
    elif name in {"face with open mouth", "hushed face", "astonished face", "face screaming in fear", "face exhaling"}:
        mouth = "oval"
    elif name in {"grimacing face", "nerd face"}:
        mouth = "grimace"
    elif any(term in name for term in ("grinning", "laughing", "tears of joy", "beaming", "partying")):
        mouth = "grin"
    elif any(term in name for term in ("frowning", "worried", "anguished", "fearful", "crying", "weary", "tired", "disappointed", "downcast", "confounded", "persevering")):
        mouth = "frown"
    elif "diagonal mouth" in name:
        mouth = "diagonal"
    elif name in {"neutral face", "expressionless face", "unamused face"}:
        mouth = "flat"
    elif any(term in name for term in ("smirking", "lying", "raised eyebrow")):
        mouth = "smirk"
    elif name in {"face with steam from nose", "enraged face", "angry face", "angry face with horns"}:
        mouth = "frown"
    elif name in {"face with medical mask"}:
        mouth = "none"
    elif name in {"face vomiting"}:
        mouth = "puke"
    elif name in {"face with thermometer", "face with head-bandage", "nauseated face", "sneezing face", "hot face", "cold face", "woozy face", "face with crossed-out eyes", "face with spiral eyes", "exploding head"}:
        mouth = "open"
    else:
        mouth = "smile"

    if any(term in name for term in ("angry", "enraged", "steam from nose", "symbols on mouth")):
        brow = "angry"
    elif any(term in name for term in ("worried", "fearful", "crying", "anguished", "anxious", "sad", "weary", "tired", "disappointed", "pensive")):
        brow = "worried"
    elif any(term in name for term in ("raised eyebrow", "smirking", "unamused", "lying")):
        brow = "skeptical"
    else:
        brow = "raised"
    return eye, mouth, brow


def draw_glasses(draw: ImageDraw.ImageDraw, kind: str) -> None:
    if kind == "sunglasses":
        draw.rounded_rectangle(box((49, 77, 116, 123)), radius=width(14), fill=rgba(INK))
        draw.rounded_rectangle(box((140, 77, 207, 123)), radius=width(14), fill=rgba(INK))
        draw.line(points([(115, 91), (141, 91)]), fill=rgba(INK), width=width(8))
        draw.line(points([(57, 83), (96, 83)]), fill=rgba(CYAN, 145), width=width(4))
        draw.line(points([(148, 83), (186, 83)]), fill=rgba(CYAN, 145), width=width(4))
    elif kind == "glasses":
        draw.ellipse(box((48, 72, 118, 133)), outline=rgba(INK), width=width(7))
        draw.ellipse(box((138, 72, 208, 133)), outline=rgba(INK), width=width(7))
        draw.line(points([(117, 92), (139, 92)]), fill=rgba(INK), width=width(6))
    elif kind == "monocle":
        draw.ellipse(box((137, 68, 207, 132)), outline=rgba(INK), width=width(7))
        draw.arc(box((173, 116, 229, 222)), 92, 274, fill=rgba(INK), width=width(4))


def draw_horns(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(points([(48, 64), (23, 48), (33, 91), (64, 95)]), fill=rgba(VIOLET), outline=rgba(INK))
    draw.polygon(points([(208, 64), (233, 48), (223, 91), (192, 95)]), fill=rgba(VIOLET), outline=rgba(INK))
    draw.polygon(points([(33, 57), (25, 51), (33, 76)]), fill=rgba(CYAN))
    draw.polygon(points([(223, 57), (231, 51), (223, 76)]), fill=rgba(CYAN))


def draw_crown(draw: ImageDraw.ImageDraw, color: str = YELLOW) -> None:
    crown = [(63, 47), (72, 8), (104, 36), (128, 3), (152, 36), (184, 8), (193, 47), (181, 70), (74, 70)]
    draw.polygon(points(crown), fill=rgba(color), outline=rgba(INK))
    draw.line(points([(74, 55), (181, 55)]), fill=rgba(INK), width=width(5))
    for x, accent in ((85, CORAL), (128, CYAN), (171, VIOLET)):
        draw.ellipse(box((x - 6, 49, x + 6, 61)), fill=rgba(accent))


def draw_accessories(canvas: Image.Image, item: AvatarDefinition) -> None:
    draw = ImageDraw.Draw(canvas)
    name = item.name

    if "halo" in name or item.id == "exclusive-void-halo":
        draw.ellipse(box((61, 3, 195, 45)), outline=rgba(YELLOW), width=width(10))
        draw.arc(box((69, 11, 187, 36)), 180, 360, fill=rgba(WHITE, 190), width=width(3))
    if "horns" in name:
        draw_horns(draw)
    if item.id in {"exclusive-crowned-chaos", "exclusive-royal-freeze"}:
        draw_crown(draw, YELLOW if item.id.endswith("chaos") else "#CBEAFF")
    if item.id == "exclusive-liquid-gold" or name == "melting face":
        for x, bottom in ((72, 245), (119, 252), (177, 241)):
            draw.rounded_rectangle(box((x - 12, 202, x + 12, bottom)), radius=width(10), fill=rgba(YELLOW), outline=rgba(INK), width=width(4))
    if "sweat" in name or name in {"hot face", "anxious face with sweat"}:
        draw_drop(draw, 205, 54, 18)
    if name in {"face with tears of joy", "rolling on the floor laughing"}:
        draw_drop(draw, 49, 112, 15)
        draw_drop(draw, 208, 112, 15)
    if name in {"smiling face with tear", "crying face", "sad but relieved face"}:
        draw_drop(draw, 187, 116, 15)
    if name in {"loudly crying face"}:
        draw.rounded_rectangle(box((57, 114, 78, 218)), radius=width(10), fill=rgba(CYAN), outline=rgba(INK), width=width(3))
        draw.rounded_rectangle(box((178, 114, 199, 218)), radius=width(10), fill=rgba(CYAN), outline=rgba(INK), width=width(3))
    if name in {"pleading face", "face holding back tears"}:
        draw.ellipse(box((67, 110, 95, 130)), fill=rgba(CYAN, 180))
        draw.ellipse(box((161, 110, 189, 130)), fill=rgba(CYAN, 180))
    if "hearts" in name and "heart-eyes" not in name:
        draw_heart(draw, 45, 67, 11, CORAL)
        draw_heart(draw, 209, 52, 13, CORAL)
        draw_heart(draw, 212, 95, 8, PINK)
    if name == "face blowing a kiss":
        draw_heart(draw, 203, 156, 13, CORAL)
    if name == "face with open hands":
        for side in (-1, 1):
            cx = 38 if side == -1 else 218
            draw.ellipse(box((cx - 25, 146, cx + 25, 206)), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(5))
            for finger in range(3):
                fx = cx + (finger - 1) * 10
                draw.ellipse(box((fx - 7, 128 - abs(finger - 1) * 5, fx + 7, 168)), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(3))
    if name in {"face with hand over mouth", "face with open eyes and hand over mouth"}:
        draw.rounded_rectangle(box((69, 143, 190, 204)), radius=width(28), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(6))
        for x in (93, 116, 139, 162):
            draw.line(points([(x, 152), (x + 7, 190)]), fill=rgba("#D49144"), width=width(3))
    if name == "face with peeking eye":
        draw.rounded_rectangle(box((43, 53, 91, 217)), radius=width(23), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(5))
        draw.rounded_rectangle(box((166, 53, 214, 217)), radius=width(23), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(5))
    if name == "shushing face":
        draw.rounded_rectangle(box((117, 114, 143, 222)), radius=width(13), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(5))
        draw.line(points([(121, 132), (139, 132)]), fill=rgba(WHITE), width=width(3))
    if name == "thinking face":
        draw.rounded_rectangle(box((145, 164, 222, 210)), radius=width(22), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(5))
        draw.rounded_rectangle(box((174, 132, 211, 188)), radius=width(18), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(5))
    if name == "saluting face":
        draw.rounded_rectangle(box((141, 47, 231, 90)), radius=width(18), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(5))
        for x in (159, 180, 201, 220):
            draw.rounded_rectangle(box((x - 7, 22, x + 9, 67)), radius=width(8), fill=rgba("#F8CD72"), outline=rgba(INK), width=width(3))
    if name == "face in clouds":
        for cx, cy, radius in ((41, 97, 32), (65, 72, 25), (203, 91, 35), (179, 63, 28), (91, 212, 35), (166, 215, 39)):
            draw.ellipse(box((cx - radius, cy - radius, cx + radius, cy + radius)), fill=rgba(WHITE, 220), outline=rgba("#BFD7E1"), width=width(3))
    if name == "dotted line face":
        draw.ellipse(box((17, 16, 239, 238)), outline=rgba(CYAN), width=width(4))
        for angle in range(0, 360, 18):
            x = 128 + math.cos(math.radians(angle)) * 108
            y = 127 + math.sin(math.radians(angle)) * 108
            draw.ellipse(box((x - 4, y - 4, x + 4, y + 4)), fill=rgba(PAPER))
    if name in {"shaking face", "head shaking horizontally"}:
        for x in (6, 246):
            draw.line(points([(x, 72), (x + (-12 if x > 128 else 12), 87)]), fill=rgba(CYAN), width=width(6))
            draw.line(points([(x, 114), (x + (-16 if x > 128 else 16), 128)]), fill=rgba(CORAL), width=width(6))
    if name == "head shaking vertically":
        draw.line(points([(97, 8), (128, -2), (159, 8)]), fill=rgba(CYAN), width=width(6))
        draw.line(points([(97, 246), (128, 256), (159, 246)]), fill=rgba(CORAL), width=width(6))
    if name == "drooling face":
        draw_drop(draw, 160, 180, 14)
    if name == "face with bags under eyes":
        draw.arc(box((51, 97, 113, 137)), 15, 165, fill=rgba(VIOLET), width=width(4))
        draw.arc(box((143, 97, 205, 137)), 15, 165, fill=rgba(VIOLET), width=width(4))
    if name == "face with medical mask":
        draw.rounded_rectangle(box((61, 126, 195, 210)), radius=width(22), fill=rgba("#C4F7F3"), outline=rgba(INK), width=width(6))
        for y in (149, 169, 189):
            draw.line(points([(80, y), (176, y)]), fill=rgba("#5ABAB8"), width=width(3))
        draw.line(points([(61, 146), (31, 125)]), fill=rgba(INK), width=width(5))
        draw.line(points([(195, 146), (225, 125)]), fill=rgba(INK), width=width(5))
    if name == "face with thermometer":
        draw.rounded_rectangle(box((139, 131, 159, 224)), radius=width(10), fill=rgba(WHITE), outline=rgba(INK), width=width(4))
        draw.ellipse(box((133, 207, 165, 239)), fill=rgba(CORAL), outline=rgba(INK), width=width(4))
        draw.line(points([(149, 156), (149, 215)]), fill=rgba(CORAL), width=width(6))
    if name == "face with head-bandage":
        draw.polygon(points([(31, 48), (193, 15), (223, 66), (59, 100)]), fill=rgba(PAPER), outline=rgba(INK))
        draw.polygon(points([(44, 28), (212, 73), (198, 105), (35, 61)]), fill=rgba("#FFF7D3"), outline=rgba(INK))
    if name == "sneezing face":
        draw.polygon(points([(77, 151), (184, 139), (197, 218), (71, 229)]), fill=rgba("#D7F8FF"), outline=rgba(INK))
        draw.line(points([(92, 170), (171, 203)]), fill=rgba(CYAN), width=width(4))
    if name == "cold face":
        for x in (78, 105, 132, 159, 186):
            draw.line(points([(x, 159), (x, 199)]), fill=rgba(WHITE), width=width(4))
    if name == "exploding head":
        burst = regular_star(128, 32, 58, 27, count=9)
        draw.polygon(points(burst), fill=rgba(CORAL), outline=rgba(INK))
        draw.polygon(points(regular_star(128, 32, 35, 16, count=9)), fill=rgba(YELLOW))
    if name == "cowboy hat face":
        draw.ellipse(box((36, 23, 220, 89)), fill=rgba(BROWN), outline=rgba(INK), width=width(6))
        draw.rounded_rectangle(box((73, -3, 185, 63)), radius=width(24), fill=rgba("#A85A32"), outline=rgba(INK), width=width(6))
        draw.line(points([(79, 45), (179, 45)]), fill=rgba(YELLOW), width=width(7))
    if name == "partying face":
        draw.polygon(points([(64, 87), (119, -12), (149, 104)]), fill=rgba(VIOLET), outline=rgba(INK))
        draw.line(points([(91, 37), (125, 47)]), fill=rgba(CYAN), width=width(6))
        draw.line(points([(73, 68), (138, 80)]), fill=rgba(YELLOW), width=width(6))
        draw.line(points([(180, 144), (238, 116)]), fill=rgba(CORAL), width=width(8))
        draw.polygon(points([(238, 116), (226, 108), (230, 128)]), fill=rgba(YELLOW))
    if name == "disguised face":
        draw_glasses(draw, "glasses")
        draw.polygon(points([(128, 104), (111, 148), (145, 148)]), fill=rgba("#E6A453"), outline=rgba(INK))
        draw.arc(box((76, 147, 130, 198)), 30, 165, fill=rgba(INK), width=width(10))
        draw.arc(box((126, 147, 180, 198)), 15, 150, fill=rgba(INK), width=width(10))
    if name == "smiling face with sunglasses":
        draw_glasses(draw, "sunglasses")
    if name == "nerd face":
        draw_glasses(draw, "glasses")
    if name == "face with monocle":
        draw_glasses(draw, "monocle")
    if name == "face with steam from nose":
        for cx in (71, 185):
            draw.ellipse(box((cx - 35, 158, cx + 4, 185)), fill=rgba(WHITE, 210))
            draw.ellipse(box((cx - 48, 166, cx - 13, 198)), fill=rgba(WHITE, 210))
    if name == "skull and crossbones":
        draw.line(points([(47, 206), (209, 246)]), fill=rgba(PAPER), width=width(18))
        draw.line(points([(209, 206), (47, 246)]), fill=rgba(PAPER), width=width(18))
        for x, y in ((43, 203), (213, 203), (43, 249), (213, 249)):
            draw.ellipse(box((x - 10, y - 10, x + 10, y + 10)), fill=rgba(PAPER), outline=rgba(INK), width=width(3))
    if item.id == "exclusive-electric-pulse":
        draw.line(points([(29, 113), (8, 128), (29, 143), (8, 158)]), fill=rgba(VIOLET), width=width(6))
        draw.line(points([(227, 113), (248, 128), (227, 143), (248, 158)]), fill=rgba(CORAL), width=width(6))
    if item.id == "exclusive-cosmic-spiral":
        for x, y, color in ((48, 45, YELLOW), (212, 65, CYAN), (38, 183, CORAL), (213, 195, LIME)):
            draw.polygon(points(regular_star(x, y, 8, 3)), fill=rgba(color))
    if item.id == "exclusive-holographic-wink":
        draw.polygon(points([(37, 136), (54, 126), (72, 139), (53, 149)]), fill=rgba(CYAN, 180))
        draw.polygon(points([(197, 126), (215, 137), (198, 151), (180, 139)]), fill=rgba(PINK, 180))


def draw_costume_overrides(canvas: Image.Image, item: AvatarDefinition) -> None:
    draw = ImageDraw.Draw(canvas)
    name = item.name
    if name in {"skull", "skull and crossbones"}:
        draw.ellipse(box((53, 67, 113, 130)), fill=rgba(INK))
        draw.ellipse(box((143, 67, 203, 130)), fill=rgba(INK))
        draw.polygon(points([(128, 116), (111, 151), (145, 151)]), fill=rgba(INK))
        draw.rounded_rectangle(box((82, 157, 174, 209)), radius=width(15), fill=rgba(INK))
        for x in (101, 119, 137, 155):
            draw.line(points([(x, 166), (x, 203)]), fill=rgba(PAPER), width=width(6))
    elif name == "pile of poo":
        draw.polygon(points([(45, 207), (211, 207), (189, 147), (174, 151), (175, 103), (148, 108), (139, 62), (101, 102), (82, 104), (82, 151), (65, 150)]), fill=rgba("#A85A32"), outline=rgba(INK))
        draw_open_eye(draw, 89, 133, scale=0.75)
        draw_open_eye(draw, 166, 133, scale=0.75)
        draw_mouth(draw, "smile")
    elif name == "clown face":
        draw.ellipse(box((104, 119, 152, 166)), fill=rgba(CORAL), outline=rgba(INK), width=width(4))
        draw.ellipse(box((37, 94, 65, 146)), fill=rgba(CYAN), outline=rgba(INK), width=width(3))
        draw.ellipse(box((191, 94, 219, 146)), fill=rgba(CYAN), outline=rgba(INK), width=width(3))
        draw.arc(box((64, 133, 192, 219)), 15, 165, fill=rgba(CORAL), width=width(13))
    elif name in {"ogre", "goblin"}:
        draw_horns(draw)
        draw.polygon(points([(128, 105), (108, 157), (148, 157)]), fill=rgba(CORAL), outline=rgba(INK))
        draw_mouth(draw, "fangs")
    elif name == "ghost":
        draw.polygon(points([(24, 211), (24, 103), (43, 48), (84, 22), (128, 13), (177, 25), (214, 58), (232, 105), (232, 224), (207, 202), (182, 230), (154, 204), (128, 234), (101, 204), (73, 229), (48, 201)]), fill=rgba(PAPER), outline=rgba(INK))
        draw.ellipse(box((65, 75, 111, 132)), fill=rgba(INK))
        draw.ellipse(box((145, 75, 191, 132)), fill=rgba(INK))
        draw.ellipse(box((99, 143, 157, 205)), fill=rgba(INK))
    elif name in {"alien", "alien monster"}:
        draw.ellipse(box((49, 57, 119, 132)), fill=rgba(INK))
        draw.ellipse(box((137, 57, 207, 132)), fill=rgba(INK))
        draw.ellipse(box((67, 68, 86, 91)), fill=rgba(WHITE))
        draw.ellipse(box((170, 68, 189, 91)), fill=rgba(WHITE))
        draw_mouth(draw, "smile" if name == "alien" else "fangs")
    elif name == "robot":
        draw.rounded_rectangle(box((17, 16, 239, 238)), radius=width(46), outline=rgba(INK), width=width(7))
        draw.line(points([(128, 18), (128, -3)]), fill=rgba(INK), width=width(7))
        draw.ellipse(box((117, -14, 139, 8)), fill=rgba(CORAL), outline=rgba(INK), width=width(3))
        draw.rounded_rectangle(box((50, 66, 111, 126)), radius=width(14), fill=rgba(CYAN), outline=rgba(INK), width=width(5))
        draw.rounded_rectangle(box((145, 66, 206, 126)), radius=width(14), fill=rgba(CYAN), outline=rgba(INK), width=width(5))
        draw.rounded_rectangle(box((72, 151, 184, 202)), radius=width(13), fill=rgba(INK))
        for x in (92, 116, 140, 164):
            draw.ellipse(box((x - 7, 167, x + 7, 181)), fill=rgba(WHITE))


def render_avatar(item: AvatarDefinition) -> Image.Image:
    canvas_size = FULL_SIZE * SUPERSAMPLE
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    palette = PALETTES[palette_name_for(item)]
    draw_sphere(canvas, palette, square=item.name == "robot")

    draw = ImageDraw.Draw(canvas)
    eye_kind, mouth_kind, brow_kind = expression_for(item)
    draw_brows(draw, brow_kind)
    left_kind = eye_kind
    right_kind = eye_kind
    if eye_kind == "wink":
        left_kind, right_kind = "closed", "open"
    if item.name == "zany face":
        left_kind, right_kind = "wide", "small"
    draw_eye(draw, 83, 102, left_kind, "left")
    draw_eye(draw, 173, 102, right_kind, "right")
    draw_mouth(draw, mouth_kind)

    if item.name == "lying face":
        draw.polygon(points([(128, 128), (219, 148), (128, 162)]), fill=rgba("#E0A647"), outline=rgba(INK))
    if item.name == "flushed face":
        draw.ellipse(box((39, 127, 86, 155)), fill=rgba(CORAL, 120))
        draw.ellipse(box((170, 127, 217, 155)), fill=rgba(CORAL, 120))
    if item.name == "distorted face":
        draw.arc(box((52, 55, 116, 139)), 30, 300, fill=rgba(CYAN), width=width(6))
        draw.line(points([(82, 166), (108, 148), (132, 184), (159, 143), (182, 169)]), fill=rgba(INK), width=width(8), joint="curve")
    if item.name == "face exhaling":
        draw.ellipse(box((178, 148, 221, 178)), fill=rgba(WHITE, 200))
        draw.ellipse(box((204, 137, 249, 171)), fill=rgba(WHITE, 180))
        draw.ellipse(box((224, 153, 267, 187)), fill=rgba(WHITE, 160))
    if item.name == "upside-down face":
        canvas = canvas.rotate(180)
    else:
        draw_accessories(canvas, item)
        if item.group in {"face-costume"} or item.name in {"skull", "skull and crossbones"}:
            draw_costume_overrides(canvas, item)

    return canvas.resize((FULL_SIZE, FULL_SIZE), Image.Resampling.LANCZOS)


def save_webp(image: Image.Image, path: Path, *, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        path,
        "WEBP",
        quality=quality,
        method=WEBP_METHOD,
        exact=True,
    )


def build_lock_badge() -> None:
    scale = 4
    canvas = Image.new("RGBA", (128 * scale, 128 * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    scale_box = lambda values: tuple(round(value * scale) for value in values)
    draw.ellipse(scale_box((9, 11, 119, 121)), fill=rgba(INK, 80))
    draw.ellipse(scale_box((5, 5, 115, 115)), fill=rgba(VIOLET), outline=rgba(INK), width=12)
    draw.arc(scale_box((37, 20, 83, 72)), 180, 360, fill=rgba(PAPER), width=18)
    draw.rounded_rectangle(scale_box((28, 50, 92, 99)), radius=14 * scale, fill=rgba(LIME), outline=rgba(INK), width=10)
    draw.ellipse(scale_box((53, 64, 67, 78)), fill=rgba(INK))
    draw.rounded_rectangle(scale_box((56, 73, 64, 88)), radius=4 * scale, fill=rgba(INK))
    canvas = canvas.resize((128, 128), Image.Resampling.LANCZOS)
    save_webp(canvas, AVATAR_LOCK, quality=92)


def build_avatar_manifest(
    definitions: Sequence[AvatarDefinition],
    atlas_rows: int,
) -> list[dict[str, object]]:
    manifest: list[dict[str, object]] = []
    for index, item in enumerate(definitions):
        atlas_column = index % ATLAS_COLUMNS
        atlas_row = index // ATLAS_COLUMNS
        palette = PALETTES[palette_name_for(item)]
        full_src = f"/havoc-avatars/full/{item.id}.webp"
        manifest.append(
            {
                "id": item.id,
                "glyph": item.unicode_reference or "✦",
                "unicodeReference": item.unicode_reference,
                "unicodeCodepoints": list(item.unicode_codepoints),
                "name": item.name,
                "group": item.group,
                "thumbnailSrc": f"/havoc-avatars/thumb/{item.id}.webp",
                "imageSrc": full_src,
                "fullSrc": full_src,
                "background": (
                    f"linear-gradient(145deg, {palette.light}, {palette.mid} 58%, "
                    f"{palette.dark})"
                ),
                "tier": item.tier,
                "locked": item.tier == "exclusive",
                "ariaLabel": (
                    f"Exclusive avatar—locked: {item.name}"
                    if item.tier == "exclusive"
                    else f"Select {item.name} avatar"
                ),
                "atlas": {
                    "src": "/havoc-avatars/havoc-avatar-atlas.webp",
                    "x": atlas_column * THUMB_SIZE,
                    "y": atlas_row * THUMB_SIZE,
                    "width": THUMB_SIZE,
                    "height": THUMB_SIZE,
                    "columns": ATLAS_COLUMNS,
                    "rows": atlas_rows,
                },
            }
        )
    return manifest


def write_typescript_manifest(
    entries: Sequence[dict[str, object]],
    *,
    standard_count: int,
    exclusive_count: int,
) -> None:
    data = json.dumps(entries, ensure_ascii=False, indent=2)
    source = f"""// Generated by scripts/build-social-assets.py. Do not edit by hand.
// Expression references: Unicode Emoji {UNICODE_VERSION}; artwork: original Havoc primitives.

export type AvatarTier = "standard" | "exclusive";

export interface AvatarAtlasFrame {{
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
}}

export interface HavocAvatar {{
  id: string;
  glyph: string;
  unicodeReference: string;
  unicodeCodepoints: readonly string[];
  name: string;
  group: string;
  thumbnailSrc: string;
  imageSrc: string;
  fullSrc: string;
  background: string;
  tier: AvatarTier;
  locked: boolean;
  ariaLabel: string;
  atlas: AvatarAtlasFrame;
}}

export const DEFAULT_HAVOC_AVATAR_ID = "smirking-face";
export const HAVOC_AVATAR_LOCK_BADGE_SRC = "/havoc-avatars/havoc-avatar-lock.webp";
export const HAVOC_AVATAR_ATLAS_SRC = "/havoc-avatars/havoc-avatar-atlas.webp";

export const HAVOC_AVATAR_COUNTS = {{
  standard: {standard_count},
  exclusive: {exclusive_count},
  total: {len(entries)},
}} as const;

export const HAVOC_AVATARS: readonly HavocAvatar[] = {data};

export const HAVOC_STANDARD_AVATARS = HAVOC_AVATARS.filter(
  (avatar) => avatar.tier === "standard",
);

export const HAVOC_EXCLUSIVE_AVATARS = HAVOC_AVATARS.filter(
  (avatar) => avatar.tier === "exclusive",
);

export function getHavocAvatar(avatarId: string): HavocAvatar {{
  return (
    HAVOC_AVATARS.find((avatar) => avatar.id === avatarId) ??
    HAVOC_AVATARS.find((avatar) => avatar.id === DEFAULT_HAVOC_AVATAR_ID) ??
    HAVOC_AVATARS[0]
  );
}}
"""
    APP_MANIFEST.write_text(source, encoding="utf-8")


def build_avatars() -> None:
    definitions = parse_catalogs()
    PUBLIC_FULL.mkdir(parents=True, exist_ok=True)
    PUBLIC_THUMB.mkdir(parents=True, exist_ok=True)
    for directory in (PUBLIC_FULL, PUBLIC_THUMB):
        for old_asset in directory.glob("*.webp"):
            old_asset.unlink()

    thumbnails: list[Image.Image] = []
    for index, item in enumerate(definitions, start=1):
        image = render_avatar(item)
        save_webp(image, PUBLIC_FULL / f"{item.id}.webp", quality=88)
        thumbnail = image.resize((THUMB_SIZE, THUMB_SIZE), Image.Resampling.LANCZOS)
        save_webp(thumbnail, PUBLIC_THUMB / f"{item.id}.webp", quality=82)
        thumbnails.append(thumbnail)
        if index % 25 == 0 or index == len(definitions):
            print(f"Rendered avatars: {index}/{len(definitions)}")

    atlas_rows = math.ceil(len(thumbnails) / ATLAS_COLUMNS)
    atlas = Image.new(
        "RGBA",
        (ATLAS_COLUMNS * THUMB_SIZE, atlas_rows * THUMB_SIZE),
        (0, 0, 0, 0),
    )
    for index, thumbnail in enumerate(thumbnails):
        atlas.alpha_composite(
            thumbnail,
            ((index % ATLAS_COLUMNS) * THUMB_SIZE, (index // ATLAS_COLUMNS) * THUMB_SIZE),
        )
    save_webp(atlas, AVATAR_ATLAS, quality=84)
    build_lock_badge()

    entries = build_avatar_manifest(definitions, atlas_rows)
    standard_count = sum(item.tier == "standard" for item in definitions)
    exclusive_count = sum(item.tier == "exclusive" for item in definitions)
    metadata = {
        "schemaVersion": 1,
        "unicodeVersion": UNICODE_VERSION,
        "artworkLicense": "Original Havoc repository artwork",
        "vendorArtworkUsed": False,
        "standardCount": standard_count,
        "exclusiveCount": exclusive_count,
        "fullSize": {"width": FULL_SIZE, "height": FULL_SIZE},
        "thumbnailSize": {"width": THUMB_SIZE, "height": THUMB_SIZE},
        "lockBadgeSrc": "/havoc-avatars/havoc-avatar-lock.webp",
        "atlasSrc": "/havoc-avatars/havoc-avatar-atlas.webp",
        "avatars": entries,
    }
    AVATAR_METADATA.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_typescript_manifest(
        entries,
        standard_count=standard_count,
        exclusive_count=exclusive_count,
    )
    print(
        f"Avatar catalog: {standard_count} standard + {exclusive_count} exclusive "
        f"({len(definitions)} total)"
    )


def source_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        while chunk := source_file.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def ffprobe(path: Path) -> dict[str, object]:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,channels",
        "-of",
        "json",
        str(path),
    ]
    return json.loads(subprocess.check_output(command, text=True))


def ensure_video_tools() -> None:
    missing = [tool for tool in ("ffmpeg", "ffprobe") if not shutil.which(tool)]
    if missing:
        raise RuntimeError(f"Missing required local tools: {', '.join(missing)}")


def loop_frame_durations(frame_count: int) -> list[int]:
    return [
        round((index + 1) * 1000 / SOCIAL_FPS) - round(index * 1000 / SOCIAL_FPS)
        for index in range(frame_count)
    ]


def frame_difference(left: Image.Image, right: Image.Image) -> float:
    difference = ImageChops.difference(left.convert("RGBA"), right.convert("RGBA"))
    stat = ImageStat.Stat(difference)
    return round(sum(stat.mean) / len(stat.mean), 4)


def green_fringe_ratio(image: Image.Image) -> float:
    converted = image.convert("RGBA")
    pixels = (
        converted.get_flattened_data()
        if hasattr(converted, "get_flattened_data")
        else converted.getdata()
    )
    visible = 0
    suspicious = 0
    for red, green, blue, alpha in pixels:
        if alpha < 16:
            continue
        visible += 1
        if green > 96 and green > red * 1.42 and green > blue * 1.42:
            suspicious += 1
    return suspicious / max(1, visible)


def build_video(source: Path) -> None:
    ensure_video_tools()
    if not source.exists():
        raise FileNotFoundError(f"Friends animation source not found: {source}")

    probe = ffprobe(source)
    video_streams = [
        stream
        for stream in probe.get("streams", [])
        if stream.get("codec_type") == "video"
    ]
    if len(video_streams) != 1:
        raise ValueError(f"Expected one video stream in {source}, found {len(video_streams)}")
    source_video = video_streams[0]
    if (source_video.get("width"), source_video.get("height")) != (1292, 712):
        raise ValueError(
            "Unexpected source dimensions; review the watermark-safe crop before rebuilding: "
            f"{source_video.get('width')} × {source_video.get('height')}"
        )
    if SOCIAL_CROP["y"] + SOCIAL_CROP["height"] > SOCIAL_WATERMARK_SAFE_Y:
        raise ValueError("Configured crop overlaps the source watermark safety boundary")

    with tempfile.TemporaryDirectory(prefix="havoc-friends-build-") as temp_directory:
        temp_path = Path(temp_directory)
        frame_pattern = temp_path / "frame-%04d.png"
        crop = SOCIAL_CROP
        video_filter = (
            f"crop={crop['width']}:{crop['height']}:{crop['x']}:{crop['y']},"
            f"colorkey={SOCIAL_KEY_COLOR}:0.19:0.075,"
            "despill=green:mix=0.88:expand=0.08,"
            f"scale={SOCIAL_WIDTH}:-2:flags=lanczos,"
            f"pad={SOCIAL_WIDTH}:{SOCIAL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black@0,"
            "format=rgba"
        )
        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-an",
            "-vf",
            video_filter,
            "-start_number",
            "0",
            str(frame_pattern),
        ]
        subprocess.run(command, check=True)
        frame_paths = sorted(temp_path.glob("frame-*.png"))
        if len(frame_paths) < 60:
            raise ValueError(f"Expected at least 60 decoded frames, found {len(frame_paths)}")
        frames = [Image.open(path).convert("RGBA") for path in frame_paths]

    seam_before = frame_difference(frames[0], frames[-1])
    blend_count = min(4, len(frames) - 1)
    for offset in range(blend_count):
        index = len(frames) - blend_count + offset
        amount = (offset + 1) / blend_count
        frames[index] = Image.blend(frames[index], frames[0], amount)
    seam_after = frame_difference(frames[0], frames[-1])

    durations = loop_frame_durations(len(frames))
    ANIMATED_SOCIAL.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        ANIMATED_SOCIAL,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        quality=82,
        method=WEBP_METHOD,
        exact=True,
        minimize_size=False,
    )
    encoded_animation = Image.open(ANIMATED_SOCIAL)
    encoded_animation.seek(0)
    encoded_first = encoded_animation.convert("RGBA")
    encoded_animation.seek(encoded_animation.n_frames - 1)
    encoded_last = encoded_animation.convert("RGBA")
    opaque_paper = Image.new("RGBA", encoded_first.size, rgba(PAPER))
    encoded_first_on_paper = Image.alpha_composite(opaque_paper, encoded_first)
    encoded_last_on_paper = Image.alpha_composite(opaque_paper, encoded_last)
    encoded_seam = frame_difference(encoded_first_on_paper, encoded_last_on_paper)
    still_index = len(frames) // 2
    save_webp(frames[still_index], STILL_SOCIAL, quality=88)
    sampled_fringe_ratio = max(
        green_fringe_ratio(frame)
        for frame in frames[:: max(1, len(frames) // 9)]
    )

    source_duration = float(probe.get("format", {}).get("duration", 0))
    metadata = {
        "schemaVersion": 1,
        "source": {
            "filename": source.name,
            "sha256": source_sha256(source),
            "width": source_video.get("width"),
            "height": source_video.get("height"),
            "durationSeconds": round(source_duration, 6),
            "fps": source_video.get("r_frame_rate"),
            "sourceHadAudio": any(
                stream.get("codec_type") == "audio"
                for stream in probe.get("streams", [])
            ),
        },
        "runtime": {
            "animatedSrc": "/havoc-friends-trio.webp",
            "reducedMotionSrc": "/havoc-friends-trio-still.webp",
            "format": "animated WebP",
            "width": SOCIAL_WIDTH,
            "height": SOCIAL_HEIGHT,
            "frames": len(frames),
            "durationMilliseconds": sum(durations),
            "loop": True,
            "muted": True,
            "containsAudio": False,
            "cropBeforeKey": SOCIAL_CROP,
            "watermarkExcluded": True,
            "greenFringeRatio": round(green_fringe_ratio(frames[still_index]), 8),
            "greenFringeRatioMaxSampled": round(sampled_fringe_ratio, 8),
            "loopSeamMeanDifferenceBefore": seam_before,
            "loopSeamMeanDifferenceAfterBlend": seam_after,
            "loopSeamMeanDifferenceAfterEncode": encoded_seam,
        },
    }
    SOCIAL_METADATA.write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Friends loop: {len(frames)} frames, {sum(durations)} ms, "
        f"{SOCIAL_WIDTH}×{SOCIAL_HEIGHT}, seam "
        f"{seam_before} → {seam_after} → encoded {encoded_seam}"
    )


def verify_transparent_webp(path: Path, expected_size: tuple[int, int]) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(path)
    image = Image.open(path)
    if image.size != expected_size:
        raise ValueError(f"{path}: expected {expected_size}, found {image.size}")
    frame = image.convert("RGBA")
    alpha = frame.getchannel("A")
    minimum, maximum = alpha.getextrema()
    if minimum != 0 or maximum == 0:
        raise ValueError(f"{path}: transparency coverage is invalid ({minimum}, {maximum})")
    return frame


def verify_assets() -> None:
    definitions = parse_catalogs()
    expected_ids = {item.id for item in definitions}
    full_ids = {path.stem for path in PUBLIC_FULL.glob("*.webp")}
    thumb_ids = {path.stem for path in PUBLIC_THUMB.glob("*.webp")}
    if full_ids != expected_ids:
        raise ValueError(
            f"Full avatar assets differ from catalog: missing={sorted(expected_ids - full_ids)}, "
            f"extra={sorted(full_ids - expected_ids)}"
        )
    if thumb_ids != expected_ids:
        raise ValueError(
            f"Thumbnail assets differ from catalog: missing={sorted(expected_ids - thumb_ids)}, "
            f"extra={sorted(thumb_ids - expected_ids)}"
        )
    for avatar_id in sorted(expected_ids):
        verify_transparent_webp(PUBLIC_FULL / f"{avatar_id}.webp", (FULL_SIZE, FULL_SIZE))
        verify_transparent_webp(PUBLIC_THUMB / f"{avatar_id}.webp", (THUMB_SIZE, THUMB_SIZE))

    atlas_rows = math.ceil(len(definitions) / ATLAS_COLUMNS)
    verify_transparent_webp(
        AVATAR_ATLAS,
        (ATLAS_COLUMNS * THUMB_SIZE, atlas_rows * THUMB_SIZE),
    )
    verify_transparent_webp(AVATAR_LOCK, (128, 128))

    avatar_metadata = json.loads(AVATAR_METADATA.read_text(encoding="utf-8"))
    if avatar_metadata["standardCount"] != EXPECTED_UNICODE_COUNT:
        raise ValueError("Avatar metadata standard count is stale")
    if avatar_metadata["exclusiveCount"] != EXPECTED_EXCLUSIVE_COUNT:
        raise ValueError("Avatar metadata exclusive count is stale")
    if avatar_metadata["vendorArtworkUsed"] is not False:
        raise ValueError("Avatar metadata must state that no vendor artwork was used")
    if APP_MANIFEST.read_text(encoding="utf-8").count('"tier": "exclusive"') != EXPECTED_EXCLUSIVE_COUNT:
        raise ValueError("TypeScript manifest does not contain exactly twelve exclusives")

    social_still = verify_transparent_webp(
        STILL_SOCIAL,
        (SOCIAL_WIDTH, SOCIAL_HEIGHT),
    )
    animated = Image.open(ANIMATED_SOCIAL)
    if animated.size != (SOCIAL_WIDTH, SOCIAL_HEIGHT):
        raise ValueError(f"Animated friends asset has unexpected size: {animated.size}")
    if not getattr(animated, "is_animated", False) or animated.n_frames < 60:
        raise ValueError("Friends WebP is not a full animated loop")
    if animated.info.get("loop") != 0:
        raise ValueError("Friends WebP is not configured to loop forever")
    if social_still.getpixel((0, 0))[3] != 0:
        raise ValueError("Friends still top-left corner is not transparent")
    fringe_ratio = green_fringe_ratio(social_still)
    if fringe_ratio > 0.001:
        raise ValueError(f"Friends still has excessive green edge pixels: {fringe_ratio:.4%}")

    social_metadata = json.loads(SOCIAL_METADATA.read_text(encoding="utf-8"))
    runtime = social_metadata["runtime"]
    if runtime["containsAudio"] is not False or runtime["muted"] is not True:
        raise ValueError("Friends runtime metadata does not guarantee a muted asset")
    if runtime["watermarkExcluded"] is not True:
        raise ValueError("Friends runtime metadata does not guarantee watermark exclusion")
    if runtime["loopSeamMeanDifferenceAfterBlend"] != 0:
        raise ValueError("Friends pre-encode loop seam is not closed")
    if runtime["loopSeamMeanDifferenceAfterEncode"] > 0.5:
        raise ValueError(
            "Friends encoded loop seam exceeds the no-flash threshold: "
            f"{runtime['loopSeamMeanDifferenceAfterEncode']}"
        )

    print(
        f"Verified {len(definitions)} avatars, atlas, lock badge, "
        f"{animated.n_frames}-frame friends loop, and reduced-motion still"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--avatars", action="store_true", help="build only avatar assets")
    selection.add_argument("--video", action="store_true", help="build only friends animation assets")
    selection.add_argument("--verify", action="store_true", help="verify committed generated assets")
    parser.add_argument(
        "--video-source",
        type=Path,
        default=DEFAULT_VIDEO_SOURCE,
        help="override the preserved source MP4",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.verify:
        verify_assets()
        return
    if args.avatars:
        build_avatars()
        verify_assets() if ANIMATED_SOCIAL.exists() else None
        return
    if args.video:
        build_video(args.video_source)
        return

    build_avatars()
    build_video(args.video_source)
    verify_assets()


if __name__ == "__main__":
    main()
