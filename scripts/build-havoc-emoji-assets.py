#!/usr/bin/env python3
"""Build Havoc's original emoji assets from approved transparent source art.

Run `extract-motion` once against the legacy public assets before replacing
them. The extracted references contain fire-only frames and joystick movement
numbers—never the legacy controller, joystick, or rocket artwork.

Run `build` whenever the approved source art or motion references change.
"""

from __future__ import annotations

import argparse
from collections import deque
import json
import math
from pathlib import Path
from statistics import median
import subprocess
import tempfile
from typing import Iterable, Sequence

from PIL import Image, ImageChops, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "emoji-source"
MOTION_DIR = SOURCE_DIR / "motion"
PUBLIC_DIR = ROOT / "public"


def load_frames(path: Path, fallback_duration: int) -> tuple[list[Image.Image], list[int], int | None]:
    image = Image.open(path)
    frames: list[Image.Image] = []
    durations: list[int] = []
    loop = image.info.get("loop")

    for index in range(getattr(image, "n_frames", 1)):
        image.seek(index)
        frames.append(image.convert("RGBA"))
        durations.append(int(image.info.get("duration") or fallback_duration))

    return frames, durations, loop


def vertical_alpha_mask(size: tuple[int, int], full_until: int, transparent_after: int) -> Image.Image:
    width, height = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)

    if full_until > 0:
        draw.rectangle((0, 0, width, min(full_until, height)), fill=255)

    span = max(1, transparent_after - full_until)
    for y in range(max(0, full_until), min(height, transparent_after)):
        strength = round(255 * (1 - (y - full_until) / span))
        draw.line((0, y, width, y), fill=strength)

    return mask


def apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = ImageChops.multiply(rgba.getchannel("A"), mask)
    rgba.putalpha(alpha)
    return rgba


def save_gif(
    frames: Sequence[Image.Image],
    path: Path,
    durations: Sequence[int],
    *,
    loop: int | None,
) -> None:
    if not frames:
        raise ValueError(f"No frames supplied for {path}")

    path.parent.mkdir(parents=True, exist_ok=True)
    kwargs: dict[str, object] = {
        "save_all": True,
        "append_images": [frame.convert("RGBA") for frame in frames[1:]],
        "duration": list(durations),
        "disposal": 2,
        "optimize": True,
    }
    if loop is not None:
        kwargs["loop"] = loop
    frames[0].convert("RGBA").save(path, **kwargs)


def save_webp(
    frames: Sequence[Image.Image],
    path: Path,
    durations: Sequence[int],
    *,
    loop: int = 0,
    lossless: bool = True,
    quality: int = 90,
    method: int = 6,
) -> None:
    if not frames:
        raise ValueError(f"No frames supplied for {path}")

    path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].convert("RGBA").save(
        path,
        save_all=True,
        append_images=[frame.convert("RGBA") for frame in frames[1:]],
        duration=list(durations),
        loop=loop,
        lossless=lossless,
        quality=quality,
        method=method,
    )


def alpha_crop(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    box = rgba.getchannel("A").getbbox()
    if not box:
        raise ValueError("Image has no visible pixels")
    return rgba.crop(box)


def place_scaled_width(image: Image.Image, width: int, canvas_size: tuple[int, int], position: tuple[int, int]) -> Image.Image:
    source = alpha_crop(image)
    height = round(source.height * width / source.width)
    resized = source.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, position)
    return canvas


def fit_canvas(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    rgba = image.convert("RGBA")
    scale = min(size[0] / rgba.width, size[1] / rgba.height)
    resized = rgba.resize(
        (max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(
        resized,
        ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2),
    )
    return canvas


def is_fire_pixel(red: int, green: int, blue: int) -> bool:
    saturated_fire = red > 145 and green > 25 and red > blue + 42
    bright_core = red > 215 and green > 165 and blue > 90
    return saturated_fire or bright_core


def controller_body(source: Image.Image) -> Image.Image:
    rgba = source.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if not alpha:
                continue
            if y < 435 or (y < 540 and is_fire_pixel(red, green, blue)):
                pixels[x, y] = (red, green, blue, 0)

    return rgba


def extract_controller_flame_frame(frame: Image.Image) -> Image.Image:
    # Stop above the legacy controller's metal top edge. The replacement body
    # overlaps this seam, so no fire is visually lost in the rebuilt frame.
    return apply_mask(frame, vertical_alpha_mask(frame.size, 222, 246))


def fit_controller_flame(frame: Image.Image) -> Image.Image:
    """Keep the fire inside the controller's top silhouette.

    The preserved fire motion was authored for a wider legacy controller. A
    stable whole-canvas horizontal squeeze keeps every frame centered without
    introducing per-frame crop jitter.
    """
    rgba = frame.convert("RGBA")
    target_width = round(rgba.width * 0.82)
    resized = rgba.resize((target_width, rgba.height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((rgba.width - target_width) // 2, 0))
    return canvas


def extract_rocket_flame_frame(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    source = rgba.load()
    result = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    target = result.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = source[x, y]
            if not alpha or alpha < 64 or y < 330:
                continue
            if y < 370 and not (125 < x < 258):
                continue
            if is_fire_pixel(red, green, blue):
                seam_alpha = min(1.0, max(0.0, (y - 330) / 30))
                target[x, y] = (red, green, blue, round(alpha * seam_alpha))

    return result


def red_ball_metrics(frame: Image.Image) -> tuple[float, float, float]:
    rgba = frame.convert("RGBA")
    candidates: set[tuple[int, int]] = set()

    for y in range(min(240, rgba.height)):
        for x in range(rgba.width):
            red, green, blue, alpha = rgba.getpixel((x, y))
            if alpha > 96 and red > 145 and red > green * 1.22 and red > blue * 1.22:
                candidates.add((x, y))

    if not candidates:
        return 180.0, 100.0, 1.0

    # The reference contains both a red joystick ball and a red action button.
    # Following the largest connected red region isolates the ball instead of
    # averaging those two unrelated controls together.
    components: list[list[tuple[int, int]]] = []
    remaining = set(candidates)
    while remaining:
        start = remaining.pop()
        queue = deque([start])
        component = [start]
        while queue:
            point_x, point_y = queue.popleft()
            for offset_x, offset_y in (
                (-1, -1),
                (0, -1),
                (1, -1),
                (-1, 0),
                (1, 0),
                (-1, 1),
                (0, 1),
                (1, 1),
            ):
                neighbor = (point_x + offset_x, point_y + offset_y)
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    queue.append(neighbor)
                    component.append(neighbor)
        components.append(component)

    points = max(components, key=len)
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    center_x = sum(xs) / len(xs)
    center_y = sum(ys) / len(ys)
    diameter = max(max(xs) - min(xs), max(ys) - min(ys))
    return center_x, center_y, float(diameter)


def extract_joystick_motion(frames: Sequence[Image.Image], durations: Sequence[int]) -> list[dict[str, float | int]]:
    pivot_x, pivot_y = 180.0, 247.0
    metrics = [red_ball_metrics(frame) for frame in frames]
    base_diameter = max(1.0, metrics[0][2])
    result: list[dict[str, float | int]] = []

    for (center_x, center_y, diameter), duration in zip(metrics, durations):
        angle = math.degrees(math.atan2(center_x - pivot_x, pivot_y - center_y))
        result.append(
            {
                "angle": round(angle, 4),
                "scale": round(diameter / base_diameter, 4),
                "duration": int(duration),
            }
        )

    return result


def write_joystick_motion(legacy_joystick: Path) -> None:
    joystick_frames, joystick_durations, _ = load_frames(legacy_joystick, 40)
    motion = extract_joystick_motion(joystick_frames, joystick_durations)
    MOTION_DIR.mkdir(parents=True, exist_ok=True)
    (MOTION_DIR / "joystick-motion.json").write_text(
        json.dumps(motion, indent=2),
        encoding="utf-8",
    )


def extract_motion(legacy_public: Path) -> None:
    MOTION_DIR.mkdir(parents=True, exist_ok=True)

    intro_frames, intro_durations, _ = load_frames(
        legacy_public / "havoc-controller-fire-intro-v6.gif",
        40,
    )
    loop_frames, loop_durations, _ = load_frames(
        legacy_public / "havoc-controller-fire-loop-v8.gif",
        40,
    )
    save_gif(
        [extract_controller_flame_frame(frame) for frame in intro_frames],
        MOTION_DIR / "controller-flame-intro.gif",
        intro_durations,
        loop=None,
    )
    save_gif(
        [extract_controller_flame_frame(frame) for frame in loop_frames],
        MOTION_DIR / "controller-flame-loop.gif",
        loop_durations,
        loop=0,
    )

    write_joystick_motion(
        legacy_public / "havoc-joystick-transparent.webp",
    )

    rocket_short, short_durations, _ = load_frames(
        legacy_public / "havoc-rocket-flame-launch.webp",
        80,
    )
    rocket_long, long_durations, _ = load_frames(
        legacy_public / "havoc-rocket-launch.webp",
        31,
    )
    save_webp(
        [extract_rocket_flame_frame(frame) for frame in rocket_short],
        MOTION_DIR / "rocket-flame-short.webp",
        short_durations,
    )
    save_webp(
        [extract_rocket_flame_frame(frame) for frame in rocket_long],
        MOTION_DIR / "rocket-flame-long.webp",
        long_durations,
    )


def build_controller() -> None:
    body_source = controller_body(Image.open(SOURCE_DIR / "controller.png"))
    body_gif = place_scaled_width(body_source, 350, (500, 500), (75, 220))

    intro_flames, intro_durations, _ = load_frames(
        MOTION_DIR / "controller-flame-intro.gif",
        40,
    )
    loop_flames, loop_durations, _ = load_frames(
        MOTION_DIR / "controller-flame-loop.gif",
        40,
    )

    intro = []
    for flame in intro_flames:
        frame = Image.new("RGBA", (500, 500), (0, 0, 0, 0))
        frame.alpha_composite(fit_controller_flame(flame))
        frame.alpha_composite(body_gif)
        intro.append(frame)

    loop = []
    for flame in loop_flames:
        frame = Image.new("RGBA", (500, 500), (0, 0, 0, 0))
        frame.alpha_composite(fit_controller_flame(flame))
        frame.alpha_composite(body_gif)
        loop.append(frame)

    save_gif(
        intro,
        PUBLIC_DIR / "havoc-controller-fire-intro-v6.gif",
        intro_durations,
        loop=None,
    )
    save_gif(
        loop,
        PUBLIC_DIR / "havoc-controller-fire-loop-v8.gif",
        loop_durations,
        loop=0,
    )

    # The shatter source must line up exactly with the displayed 500px loop.
    # Upscaling the composed final loop frame avoids any handoff jump and keeps
    # all legacy controller pixels out of the high-resolution shard image.
    shatter = loop[-1].resize((1254, 1254), Image.Resampling.LANCZOS)
    shatter.save(PUBLIC_DIR / "havoc-controller-fire-shatter.png", optimize=True)

    white = Image.new("RGBA", (1254, 1254), (255, 255, 255, 255))
    white.alpha_composite(shatter)
    white.convert("RGB").save(PUBLIC_DIR / "havoc-controller-fire.png", optimize=True)


def joystick_layers() -> tuple[Image.Image, Image.Image, tuple[float, float]]:
    source = Image.open(SOURCE_DIR / "joystick.png").convert("RGBA")
    alpha = source.getchannel("A")
    base = source.copy()
    moving = source.copy()
    base_alpha = alpha.copy()
    moving_alpha = Image.new("L", source.size, 0)

    base_pixels = base_alpha.load()
    moving_pixels = moving_alpha.load()
    for y in range(source.height):
        for x in range(source.width):
            original_alpha = alpha.getpixel((x, y))
            if not original_alpha:
                continue
            ball = y < 475 and 300 < x < 750
            stem = (
                445 <= y < 585
                and 450 < x < 610
                and max(source.getpixel((x, y))[:3]) > 78
            )
            if ball or stem:
                moving_pixels[x, y] = original_alpha
                base_pixels[x, y] = 0

    base.putalpha(base_alpha)
    moving.putalpha(moving_alpha)

    object_box = alpha.getbbox()
    if not object_box:
        raise ValueError("Joystick source is empty")
    base = base.crop(object_box).resize((335, 320), Image.Resampling.LANCZOS)
    moving = moving.crop(object_box).resize((335, 320), Image.Resampling.LANCZOS)

    base_canvas = Image.new("RGBA", (360, 480), (0, 0, 0, 0))
    moving_canvas = Image.new("RGBA", (360, 480), (0, 0, 0, 0))
    position = (12, 78)
    base_canvas.alpha_composite(base, position)
    moving_canvas.alpha_composite(moving, position)

    source_pivot = (530.0, 590.0)
    scale_x = 335 / (object_box[2] - object_box[0])
    scale_y = 320 / (object_box[3] - object_box[1])
    pivot = (
        position[0] + (source_pivot[0] - object_box[0]) * scale_x,
        position[1] + (source_pivot[1] - object_box[1]) * scale_y,
    )

    draw = ImageDraw.Draw(base_canvas)
    px, py = pivot
    for width, height, color in (
        (48, 19, (25, 25, 27, 255)),
        (34, 13, (42, 42, 44, 255)),
    ):
        draw.ellipse(
            (px - width / 2, py - height / 2, px + width / 2, py + height / 2),
            fill=color,
        )

    return base_canvas, moving_canvas, pivot


def build_joystick() -> None:
    base, moving, pivot = joystick_layers()
    motion = json.loads((MOTION_DIR / "joystick-motion.json").read_text(encoding="utf-8"))
    frames: list[Image.Image] = []
    durations: list[int] = []

    source_center_x, source_center_y, _ = red_ball_metrics(moving)
    source_angle = math.degrees(
        math.atan2(source_center_x - pivot[0], pivot[1] - source_center_y)
    )
    straightening_candidates = (
        moving.rotate(
            source_angle,
            resample=Image.Resampling.BICUBIC,
            center=pivot,
        ),
        moving.rotate(
            -source_angle,
            resample=Image.Resampling.BICUBIC,
            center=pivot,
        ),
    )
    straight_moving = min(
        straightening_candidates,
        key=lambda candidate: abs(red_ball_metrics(candidate)[0] - pivot[0]),
    )

    # The legacy motion data's "center" leaned about fifteen degrees left.
    # Normalize around the first resting beat, then snap every near-center
    # return exactly vertical so each tilt reads as a complete movement.
    resting_angle = median(float(step["angle"]) for step in motion[:6])

    for step in motion:
        motion_angle = float(step["angle"]) - resting_angle
        if abs(motion_angle) < 1.75:
            motion_angle = 0.0
        rotated = straight_moving.rotate(
            -motion_angle,
            resample=Image.Resampling.BICUBIC,
            center=pivot,
        )
        frame = Image.new("RGBA", (360, 480), (0, 0, 0, 0))
        frame.alpha_composite(base)
        frame.alpha_composite(rotated)
        frames.append(frame)
        durations.append(int(step["duration"]))

    save_webp(
        frames,
        PUBLIC_DIR / "havoc-joystick-transparent.webp",
        durations,
    )
    frames[0].save(PUBLIC_DIR / "havoc-joystick-still.png", optimize=True)


def rocket_layers() -> tuple[Image.Image, Image.Image, tuple[int, int]]:
    source = Image.open(SOURCE_DIR / "rocket.png").convert("RGBA")
    # Keep the approved flame in the base layer so a pulsed overlay can never
    # expose a seam at the engine.
    body = source.copy()
    flame = Image.new("RGBA", source.size, (0, 0, 0, 0))
    source_pixels = source.load()
    flame_pixels = flame.load()

    for y in range(source.height):
        for x in range(source.width):
            red, green, blue, alpha = source_pixels[x, y]
            in_exhaust = y > 700 and x < 650
            if alpha and in_exhaust and is_fire_pixel(red, green, blue):
                flame_pixels[x, y] = (red, green, blue, alpha)

    object_box = source.getchannel("A").getbbox()
    if not object_box:
        raise ValueError("Rocket source is empty")
    width = 315
    height = round((object_box[3] - object_box[1]) * width / (object_box[2] - object_box[0]))
    position = (55, 72)
    body_resized = body.crop(object_box).resize((width, height), Image.Resampling.LANCZOS)
    flame_resized = flame.crop(object_box).resize((width, height), Image.Resampling.LANCZOS)
    body_canvas = Image.new("RGBA", (383, 665), (0, 0, 0, 0))
    flame_canvas = Image.new("RGBA", (383, 665), (0, 0, 0, 0))
    body_canvas.alpha_composite(body_resized, position)
    flame_canvas.alpha_composite(flame_resized, position)

    engine = (520.0, 730.0)
    scale = width / (object_box[2] - object_box[0])
    anchor = (
        round(position[0] + (engine[0] - object_box[0]) * scale),
        round(position[1] + (engine[1] - object_box[1]) * scale),
    )
    return body_canvas, flame_canvas, anchor


def pulse_layer(
    layer: Image.Image,
    anchor: tuple[int, int],
    scale: float,
    brightness: float,
    shift: tuple[int, int],
) -> Image.Image:
    box = layer.getchannel("A").getbbox()
    if not box:
        return Image.new("RGBA", layer.size, (0, 0, 0, 0))
    crop = layer.crop(box)
    alpha = crop.getchannel("A")
    color = ImageEnhance.Brightness(crop.convert("RGB")).enhance(brightness).convert("RGBA")
    color.putalpha(alpha)
    resized = color.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.BICUBIC,
    )
    relative_anchor = (anchor[0] - box[0], anchor[1] - box[1])
    position = (
        round(anchor[0] - relative_anchor[0] * scale + shift[0]),
        round(anchor[1] - relative_anchor[1] * scale + shift[1]),
    )
    canvas = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, position)
    return canvas


def flame_metric(frame: Image.Image) -> int:
    alpha = frame.convert("RGBA").getchannel("A")
    return sum(1 for value in alpha.get_flattened_data() if value > 64)


def render_rocket_frames(reference_flames: Iterable[Image.Image]) -> list[Image.Image]:
    references = list(reference_flames)
    metrics = [flame_metric(frame) for frame in references]
    minimum = min(metrics) if metrics else 0
    span = max(1, (max(metrics) if metrics else 1) - minimum)
    body, approved_flame, anchor = rocket_layers()
    output: list[Image.Image] = []
    for index, metric in enumerate(metrics):
        measured = (metric - minimum) / span
        organic = 0.5 + 0.34 * math.sin(index * 1.73) + 0.16 * math.sin(index * 0.67)
        energy = min(1.0, max(0.0, measured * 0.58 + organic * 0.42))
        flame = pulse_layer(
            approved_flame,
            anchor,
            0.91 + 0.16 * energy,
            0.92 + 0.18 * energy,
            (round(1.5 * math.sin(index * 1.31)), round(1.2 * math.cos(index * 1.11))),
        )
        frame = Image.new("RGBA", (383, 665), (0, 0, 0, 0))
        frame.alpha_composite(flame)
        frame.alpha_composite(body)
        output.append(frame)
    return output


def build_rocket_launch_video() -> None:
    source = SOURCE_DIR / "rocket-launch-source.mp4"
    with tempfile.TemporaryDirectory(prefix="havoc-rocket-") as temporary:
        output_pattern = Path(temporary) / "frame-%03d.png"
        # Crop the source to the full rocket and flame, key out the true-black
        # background, then center the artwork on the existing animation canvas.
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(source),
                "-t",
                "1.125",
                "-vf",
                (
                    "format=rgba,"
                    "colorkey=0x000000:0.08:0.05,"
                    "crop=880:1810:100:60,"
                    "scale=302:620:flags=lanczos,"
                    "pad=383:665:40:20:color=0x00000000"
                ),
                "-an",
                "-vsync",
                "0",
                str(output_pattern),
            ],
            check=True,
        )
        frames = [
            Image.open(path).convert("RGBA").copy()
            for path in sorted(Path(temporary).glob("frame-*.png"))
        ]

    if not frames:
        raise RuntimeError("ffmpeg did not render any rocket launch frames")

    frame_duration = round(1000 / 24)
    save_webp(
        frames,
        PUBLIC_DIR / "havoc-rocket-flame-launch.webp",
        [frame_duration] * len(frames),
        lossless=False,
        quality=84,
        method=4,
    )
    frames[0].save(PUBLIC_DIR / "havoc-rocket-cutout.png", optimize=True)


def build_rocket() -> None:
    build_rocket_launch_video()


def build() -> None:
    required = (
        SOURCE_DIR / "controller.png",
        SOURCE_DIR / "joystick.png",
        SOURCE_DIR / "rocket.png",
        SOURCE_DIR / "rocket-launch-source.mp4",
        MOTION_DIR / "controller-flame-intro.gif",
        MOTION_DIR / "controller-flame-loop.gif",
        MOTION_DIR / "joystick-motion.json",
    )
    missing = [path for path in required if not path.exists()]
    if missing:
        formatted = "\n".join(f"- {path.relative_to(ROOT)}" for path in missing)
        raise SystemExit(f"Missing required source files:\n{formatted}")

    build_controller()
    build_joystick()
    build_rocket()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    extract = subparsers.add_parser("extract-motion")
    extract.add_argument(
        "--legacy-public",
        type=Path,
        default=PUBLIC_DIR,
        help="Directory containing the pre-replacement animated assets",
    )
    extract_joystick = subparsers.add_parser("extract-joystick")
    extract_joystick.add_argument(
        "--legacy-joystick",
        type=Path,
        required=True,
        help="Path to the pre-replacement animated joystick WebP",
    )
    subparsers.add_parser("build-rocket")
    subparsers.add_parser("build")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "extract-motion":
        extract_motion(args.legacy_public.resolve())
    elif args.command == "extract-joystick":
        write_joystick_motion(args.legacy_joystick.resolve())
    elif args.command == "build-rocket":
        build_rocket_launch_video()
    else:
        build()


if __name__ == "__main__":
    main()
