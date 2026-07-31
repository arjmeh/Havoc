"""Import every generated GLB and validate its model structure in Blender."""

from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIR = ROOT / "public" / "calibration-models"
REPORT_DIR = ROOT / "docs" / "screenshots" / "calibration-3d-assets"
MODELS = (
    "glass-tumbler.glb",
    "ice-face-cube-shell.glb",
    "ice-cube-field.glb",
)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def validate(path: Path) -> dict[str, object]:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise ValueError(f"{path.name}: imported with no mesh objects")
    material_names = sorted(
        {
            slot.material.name
            for obj in meshes
            for slot in obj.material_slots
            if slot.material is not None
        }
    )
    if not material_names:
        raise ValueError(f"{path.name}: imported with no materials")

    world_points: list[Vector] = []
    for obj in meshes:
        world_points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector(
        (
            min(point.x for point in world_points),
            min(point.y for point in world_points),
            min(point.z for point in world_points),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in world_points),
            max(point.y for point in world_points),
            max(point.z for point in world_points),
        )
    )
    extent = maximum - minimum
    if min(extent) <= 0.01 or max(extent) > 10:
        raise ValueError(f"{path.name}: implausible imported bounds {tuple(extent)}")
    return {
        "file": path.name,
        "meshObjects": len(meshes),
        "materials": material_names,
        "boundsMin": [round(value, 4) for value in minimum],
        "boundsMax": [round(value, 4) for value in maximum],
        "extent": [round(value, 4) for value in extent],
    }


def main() -> None:
    results = [validate(PUBLIC_DIR / filename) for filename in MODELS]
    report = {"blenderVersion": bpy.app.version_string, "models": results}
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    output = REPORT_DIR / "glb-import-validation.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
