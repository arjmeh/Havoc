# Havoc Calibration Lab 3D kit

This directory contains the editable source for the Calibration Lab’s
glass-world sequence. Every visible object is original, procedurally generated
from Blender primitives, and uses no paid or third-party mesh, texture, font,
service, or trial.

## Contents

- `generate_calibration_kit.py` deterministically rebuilds the scene, renders
  transparent sprites, and exports browser-ready GLB models.
- `havoc-calibration-3d-kit.blend` is the editable Blender 5.2 LTS scene
  produced by the script.
- `renders/` keeps lossless transparent PNG masters. The runtime directory
  contains smaller quality-92 WebP copies with lossless alpha.

Runtime exports are in `public/calibration-models/`. A review contact sheet is
in `docs/screenshots/calibration-3d-assets/`.

## Rebuild

From the repository root:

```sh
blender --background \
  --python source-assets/calibration-3d/generate_calibration_kit.py
python3 source-assets/calibration-3d/validate_and_preview.py
blender --background \
  --python source-assets/calibration-3d/validate_glb_import.py
```

The generator uses an orthographic studio rig so sprites retain consistent
scale across views. The GLB files use real geometry and standard Principled
materials, allowing a WebGL runtime to relight them.

Validation checks sprite alpha and visible bounds, WebP alpha fidelity and
compression delta, GLB magic and size, and a full Blender re-import with mesh,
material, and world-bound checks.

## Runtime composition notes

### Hidden-container / glass reveal

Use the transparent front tumbler sprite only after the camera begins pulling
away from the phone. While the camera is inside the glass, render no rim or
glass wall; clip the liquid simulation directly to the phone stage. During the
pullback, crossfade into `glass-tumbler-front.webp`, then transition to
`glass-tumbler-three-quarter.webp` for the wide field.

The glass model includes custom liquid-bound metadata. The same values are
also copied to `public/calibration-models/manifest.json`.

### Frozen portrait cube

Place the captured portrait behind `ice-face-cube-shell-front.webp` and crop it
to a square. The nominal portrait opening is 2.06 × 2.06 Blender units inside a
2.96-unit shell. Keep the portrait at about 70% of the shell’s visible width
and add a subtle cyan tint; the frosted edge remains readable without hiding
the face.

The field cube has the same outer size as the face cube. That guarantees the
falling ice reads as physically consistent with the frozen portrait cube.

## Material direction

- Clear glass: restrained cyan optical edge, clean white studio highlights,
  and a violet/coral rim response from the Havoc palette.
- Ice: translucent cyan, frosted rounded perimeter, internal bubbles,
  controlled cracks, and asymmetric facets.
- Surfaces are intentionally premium stylized realism, not photographic glass.
  The silhouettes remain legible on Havoc’s cream background and on saturated
  liquid colors.

## License and provenance

Created procedurally for the Havoc repository with Blender 5.2 LTS. No external
assets were downloaded, traced, or embedded.
