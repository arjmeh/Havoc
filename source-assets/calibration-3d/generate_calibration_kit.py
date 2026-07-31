"""Generate Havoc's editable Calibration Lab glass and ice asset kit.

Run from the repository root:

    blender --background --python source-assets/calibration-3d/generate_calibration_kit.py

The script is deterministic and uses only Blender primitives. It creates:

* an editable Blender source scene;
* separate GLB exports for the tumbler, face-cube shell, and field ice cube;
* transparent PNG sprite views sized for the mobile runtime.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "source-assets" / "calibration-3d"
RENDER_DIR = SOURCE_DIR / "renders"
PUBLIC_DIR = ROOT / "public" / "calibration-models"
PREVIEW_DIR = ROOT / "docs" / "screenshots" / "calibration-3d-assets"

for directory in (SOURCE_DIR, RENDER_DIR, PUBLIC_DIR, PREVIEW_DIR):
    directory.mkdir(parents=True, exist_ok=True)

random.seed(7048)

INK = (0.067, 0.063, 0.082, 1.0)
ICE = (0.21, 0.875, 0.957, 1.0)
ICE_LIGHT = (0.78, 0.976, 1.0, 1.0)
VIOLET = (0.439, 0.282, 1.0, 1.0)
CORAL = (1.0, 0.31, 0.384, 1.0)
WHITE = (1.0, 1.0, 1.0, 1.0)


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def move_to_collection(
    obj: bpy.types.Object, target: bpy.types.Collection
) -> bpy.types.Object:
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def principled_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    alpha: float = 1.0,
    roughness: float = 0.2,
    metallic: float = 0.0,
    transmission: float = 0.0,
    ior: float = 1.45,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color[:3], alpha)
    mat.surface_render_method = "DITHERED"
    mat.use_transparency_overlap = False
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Alpha"].default_value = alpha
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["Coat Weight"].default_value = 0.28
    bsdf.inputs["Coat Roughness"].default_value = max(0.04, roughness * 0.5)
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def curve_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    alpha: float = 1.0,
    strength: float = 0.0,
) -> bpy.types.Material:
    return principled_material(
        name,
        color,
        alpha=alpha,
        roughness=0.12,
        transmission=0.1,
        emission=color if strength else None,
        emission_strength=strength,
    )


def add_beveled_cube(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    bevel: float,
    segments: int = 6,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft edge", "BEVEL")
    modifier.width = bevel
    modifier.segments = segments
    obj.data.materials.append(material)
    return move_to_collection(obj, target)


def add_bezier_curve(
    name: str,
    points: Sequence[tuple[float, float, float]],
    material: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    radius: float,
) -> bpy.types.Object:
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = 5
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for handle, point in zip(spline.bezier_points, points):
        handle.co = point
        handle.handle_left_type = "AUTO"
        handle.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    data.materials.append(material)
    target.objects.link(obj)
    return obj


def add_polygon(
    name: str,
    points: Sequence[tuple[float, float, float]],
    material: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], [tuple(range(len(points)))])
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    return obj


def build_tumbler(target: bpy.types.Collection) -> list[bpy.types.Object]:
    glass = principled_material(
        "Glass body",
        (0.72, 0.92, 0.98, 1.0),
        alpha=0.24,
        roughness=0.055,
        transmission=0.82,
        ior=1.47,
    )
    edge = principled_material(
        "Glass edge",
        (0.82, 0.98, 1.0, 1.0),
        alpha=0.64,
        roughness=0.08,
        transmission=0.42,
        ior=1.47,
        emission=(0.25, 0.75, 0.92, 1.0),
        emission_strength=0.04,
    )
    highlight = curve_material(
        "Glass studio highlight", WHITE, alpha=0.76, strength=0.08
    )
    base_tint = principled_material(
        "Glass base tint",
        (0.2, 0.72, 0.86, 1.0),
        alpha=0.22,
        roughness=0.11,
        transmission=0.55,
        ior=1.46,
    )

    segments = 96
    rings = (
        (1.12, -1.48),
        (1.42, 1.55),
        (1.25, 1.51),
        (0.98, -1.25),
    )
    vertices: list[tuple[float, float, float]] = []
    for radius, z in rings:
        vertices.extend(
            (
                radius * math.cos(index * math.tau / segments),
                radius * math.sin(index * math.tau / segments),
                z,
            )
            for index in range(segments)
        )
    faces: list[tuple[int, int, int, int]] = []
    for ring_index in range(4):
        next_ring = (ring_index + 1) % 4
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append(
                (
                    ring_index * segments + index,
                    ring_index * segments + next_index,
                    next_ring * segments + next_index,
                    next_ring * segments + index,
                )
            )
    mesh = bpy.data.meshes.new("Tumbler mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(glass)
    body = bpy.data.objects.new("Havoc clear tumbler", mesh)
    target.objects.link(body)
    bevel = body.modifiers.new("Polished glass edges", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 4
    body["havoc_asset_role"] = "calibration-glass"
    body["liquid_inner_bottom_radius"] = 0.98
    body["liquid_inner_top_radius"] = 1.25
    body["liquid_bottom_z"] = -1.24
    body["liquid_max_z"] = 1.32

    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.335,
        minor_radius=0.085,
        major_segments=96,
        minor_segments=20,
        location=(0.0, 0.0, 1.53),
    )
    rim = bpy.context.object
    rim.name = "Optical rim"
    rim.data.materials.append(edge)
    move_to_collection(rim, target)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.045,
        minor_radius=0.065,
        major_segments=96,
        minor_segments=18,
        location=(0.0, 0.0, -1.39),
    )
    base = bpy.context.object
    base.name = "Weighted base rim"
    base.data.materials.append(base_tint)
    move_to_collection(base, target)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=96,
        radius=1.035,
        depth=0.18,
        location=(0.0, 0.0, -1.34),
    )
    base_disc = bpy.context.object
    base_disc.name = "Weighted glass base"
    base_disc.data.materials.append(base_tint)
    bevel = base_disc.modifiers.new("Base softness", "BEVEL")
    bevel.width = 0.08
    bevel.segments = 5
    move_to_collection(base_disc, target)

    left_highlight = add_bezier_curve(
        "Long glass highlight",
        (
            (-0.72, -0.91, -0.98),
            (-0.78, -1.05, -0.04),
            (-0.84, -1.09, 0.96),
        ),
        highlight,
        target,
        radius=0.028,
    )
    right_highlight = add_bezier_curve(
        "Short glass highlight",
        (
            (0.72, -0.91, 0.18),
            (0.77, -1.04, 0.62),
            (0.81, -1.08, 1.02),
        ),
        highlight,
        target,
        radius=0.018,
    )

    return [body, rim, base, base_disc, left_highlight, right_highlight]


def build_ice_shell(
    target: bpy.types.Collection, *, face_window: bool
) -> list[bpy.types.Object]:
    ice_body = principled_material(
        "Ice body" if face_window else "Field ice body",
        ICE,
        alpha=0.28,
        roughness=0.16,
        transmission=0.62,
        ior=1.31,
        emission=(0.05, 0.33, 0.48, 1.0),
        emission_strength=0.045,
    )
    frost = principled_material(
        "Ice frost" if face_window else "Field ice frost",
        ICE_LIGHT,
        alpha=0.58,
        roughness=0.46,
        transmission=0.18,
        ior=1.31,
    )
    crack = curve_material(
        "Ice crack" if face_window else "Field ice crack",
        (0.92, 1.0, 1.0, 1.0),
        alpha=0.88,
        strength=0.12,
    )
    facet = principled_material(
        "Ice facet" if face_window else "Field ice facet",
        (0.74, 0.95, 1.0, 1.0),
        alpha=0.18,
        roughness=0.09,
        transmission=0.36,
        ior=1.31,
    )
    bubble = principled_material(
        "Ice bubbles" if face_window else "Field ice bubbles",
        WHITE,
        alpha=0.34,
        roughness=0.08,
        transmission=0.76,
        ior=1.04,
    )

    objects: list[bpy.types.Object] = []
    body = add_beveled_cube(
        "Face-cube optical shell" if face_window else "Field ice cube",
        (2.96, 0.9, 2.96),
        (0.0, 0.0, 0.0),
        ice_body,
        target,
        bevel=0.28,
        segments=8,
    )
    body["havoc_asset_role"] = "face-cube-shell" if face_window else "field-ice-cube"
    if face_window:
        body["portrait_window_x"] = 2.06
        body["portrait_window_z"] = 2.06
        body["portrait_plane_y"] = -0.485
    objects.append(body)

    if face_window:
        frame_dimensions = (
            ("Top frost", (2.48, 0.13, 0.32), (0.0, -0.49, 1.13)),
            ("Bottom frost", (2.48, 0.13, 0.32), (0.0, -0.49, -1.13)),
            ("Left frost", (0.32, 0.13, 2.06), (-1.13, -0.49, 0.0)),
            ("Right frost", (0.32, 0.13, 2.06), (1.13, -0.49, 0.0)),
        )
        for name, dimensions, location in frame_dimensions:
            objects.append(
                add_beveled_cube(
                    name,
                    dimensions,
                    location,
                    frost,
                    target,
                    bevel=0.13,
                    segments=6,
                )
            )

    front_y = -0.556
    facet_points = (
        ((-1.28, front_y, 1.2), (-0.14, front_y, 1.42), (-0.78, front_y, 0.82)),
        ((0.28, front_y, 1.42), (1.28, front_y, 0.86), (0.82, front_y, 0.48)),
        ((-1.38, front_y, -0.38), (-0.84, front_y, -1.28), (-0.46, front_y, -0.74)),
        ((0.74, front_y, -0.72), (1.33, front_y, -1.16), (1.23, front_y, -0.16)),
    )
    for index, points in enumerate(facet_points):
        objects.append(add_polygon(f"Ice facet {index + 1}", points, facet, target))

    crack_paths = (
        ((-1.28, front_y - 0.01, 0.42), (-1.04, front_y - 0.01, 0.29), (-0.87, front_y - 0.01, 0.06)),
        ((1.28, front_y - 0.01, -0.2), (1.05, front_y - 0.01, -0.34), (0.91, front_y - 0.01, -0.62)),
        ((0.54, front_y - 0.01, 1.37), (0.38, front_y - 0.01, 1.16), (0.26, front_y - 0.01, 0.98)),
    )
    for index, points in enumerate(crack_paths):
        objects.append(
            add_bezier_curve(
                f"Ice crack {index + 1}",
                points,
                crack,
                target,
                radius=0.014 if face_window else 0.02,
            )
        )

    bubble_count = 18 if face_window else 28
    for index in range(bubble_count):
        x = random.uniform(-1.17, 1.17)
        z = random.uniform(-1.17, 1.17)
        if face_window and abs(x) < 0.86 and abs(z) < 0.86:
            x = math.copysign(random.uniform(0.98, 1.17), x or 1)
        y = random.uniform(-0.28, 0.28)
        radius = random.uniform(0.022, 0.065)
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2,
            radius=radius,
            location=(x, y, z),
        )
        sphere = bpy.context.object
        sphere.name = f"Ice bubble {index + 1:02d}"
        sphere.data.materials.append(bubble)
        move_to_collection(sphere, target)
        objects.append(sphere)

    return objects


def add_camera() -> bpy.types.Object:
    data = bpy.data.cameras.new("Asset camera")
    data.type = "ORTHO"
    data.lens = 52
    camera = bpy.data.objects.new("Asset camera", data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def look_at(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    color: tuple[float, float, float],
    size: float,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    light.location = location
    bpy.context.scene.collection.objects.link(light)
    look_at(light, (0.0, 0.0, 0.0))
    return light


def configure_scene() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 70
    scene.render.film_transparent = True
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.35
    scene.view_settings.view_transform = "AgX"
    scene.render.use_file_extension = True
    scene.render.use_compositing = True
    scene.render.use_sequencer = False
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100

    world = scene.world or bpy.data.worlds.new("Havoc studio world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.025, 0.035, 0.05, 1.0)
    background.inputs["Strength"].default_value = 0.55

    camera = add_camera()
    add_area_light("Key softbox", (-4.5, -5.0, 6.0), 880, (1.0, 0.95, 0.9), 5.0)
    add_area_light("Cyan fill", (5.5, -3.0, 2.5), 620, (0.3, 0.9, 1.0), 4.0)
    add_area_light("Violet rim", (2.0, 4.5, 5.5), 980, (0.44, 0.28, 1.0), 3.0)
    add_area_light("Top strip", (-1.0, 0.0, 7.0), 760, (1.0, 0.42, 0.5), 3.5)
    return camera


def set_visible(
    collections: Iterable[bpy.types.Collection], visible: bpy.types.Collection
) -> None:
    for item in collections:
        item.hide_render = item != visible
        item.hide_viewport = item != visible


def render(
    camera: bpy.types.Object,
    target_collection: bpy.types.Collection,
    all_collections: Sequence[bpy.types.Collection],
    filename: str,
    *,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    ortho_scale: float,
) -> None:
    set_visible(all_collections, target_collection)
    camera.location = location
    camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    path = RENDER_DIR / filename
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def export_collection(
    target: bpy.types.Collection,
    all_collections: Sequence[bpy.types.Collection],
    filename: str,
) -> None:
    set_visible(all_collections, target)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in target.all_objects:
        if obj.type in {"MESH", "CURVE"}:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = next(
        obj for obj in target.all_objects if obj.type == "MESH"
    )
    bpy.ops.export_scene.gltf(
        filepath=str(PUBLIC_DIR / filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )


def main() -> None:
    clean_scene()
    tumbler_collection = collection("CALIBRATION_GLASS")
    face_ice_collection = collection("CALIBRATION_FACE_ICE")
    field_ice_collection = collection("CALIBRATION_FIELD_ICE")
    collections = (
        tumbler_collection,
        face_ice_collection,
        field_ice_collection,
    )
    build_tumbler(tumbler_collection)
    build_ice_shell(face_ice_collection, face_window=True)
    build_ice_shell(field_ice_collection, face_window=False)
    camera = configure_scene()

    render(
        camera,
        tumbler_collection,
        collections,
        "glass-tumbler-front.png",
        location=(0.0, -8.5, 0.45),
        target=(0.0, 0.0, 0.0),
        ortho_scale=4.35,
    )
    render(
        camera,
        tumbler_collection,
        collections,
        "glass-tumbler-three-quarter.png",
        location=(4.8, -7.6, 3.2),
        target=(0.0, 0.0, 0.0),
        ortho_scale=4.8,
    )
    render(
        camera,
        tumbler_collection,
        collections,
        "glass-tumbler-top.png",
        location=(4.2, -6.0, 7.2),
        target=(0.0, 0.0, 0.25),
        ortho_scale=4.7,
    )
    render(
        camera,
        face_ice_collection,
        collections,
        "ice-face-cube-shell-front.png",
        location=(0.0, -8.0, 0.0),
        target=(0.0, 0.0, 0.0),
        ortho_scale=4.25,
    )
    render(
        camera,
        face_ice_collection,
        collections,
        "ice-face-cube-shell-three-quarter.png",
        location=(4.8, -8.0, 3.7),
        target=(0.0, 0.0, 0.0),
        ortho_scale=4.75,
    )
    render(
        camera,
        field_ice_collection,
        collections,
        "ice-cube-field.png",
        location=(4.2, -7.2, 3.7),
        target=(0.0, 0.0, 0.0),
        ortho_scale=4.75,
    )

    export_collection(tumbler_collection, collections, "glass-tumbler.glb")
    export_collection(face_ice_collection, collections, "ice-face-cube-shell.glb")
    export_collection(field_ice_collection, collections, "ice-cube-field.glb")

    for item in collections:
        item.hide_render = False
        item.hide_viewport = False
    bpy.ops.wm.save_as_mainfile(
        filepath=str(SOURCE_DIR / "havoc-calibration-3d-kit.blend")
    )

    manifest = {
        "generator": "Blender 5.2 LTS / procedural Havoc-authored geometry",
        "license": "Original project asset; no third-party geometry or textures.",
        "units": "Blender meters (runtime may normalize)",
        "assets": {
            "glass-tumbler": {
                "model": "/calibration-models/glass-tumbler.glb",
                "sprites": [
                    "/calibration-models/glass-tumbler-front.webp",
                    "/calibration-models/glass-tumbler-three-quarter.webp",
                    "/calibration-models/glass-tumbler-top.webp",
                ],
                "liquidBounds": {
                    "bottomRadius": 0.98,
                    "topRadius": 1.25,
                    "bottomZ": -1.24,
                    "maxZ": 1.32,
                },
            },
            "face-cube-shell": {
                "model": "/calibration-models/ice-face-cube-shell.glb",
                "sprites": [
                    "/calibration-models/ice-face-cube-shell-front.webp",
                    "/calibration-models/ice-face-cube-shell-three-quarter.webp",
                ],
                "portraitWindow": {
                    "width": 2.06,
                    "height": 2.06,
                    "planeY": -0.485,
                },
            },
            "field-ice-cube": {
                "model": "/calibration-models/ice-cube-field.glb",
                "sprites": ["/calibration-models/ice-cube-field.webp"],
            },
        },
    }
    (PUBLIC_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Generated Calibration Lab kit in {PUBLIC_DIR}")


if __name__ == "__main__":
    main()
