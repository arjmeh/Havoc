# Havoc avatar source catalog

This directory is the editable, vendor-neutral source for the onboarding avatar
catalog.

- `unicode-face-catalog-17.0.tsv` records every fully qualified entry from the
  twelve Unicode Emoji 17.0 `face-*` subgroups in `Smileys & Emotion`.
- `exclusive-avatar-catalog.tsv` defines twelve original locked Havoc variants.
- `scripts/build-social-assets.py` renders the catalog with deterministic local
  drawing primitives into transparent WebP files and a thumbnail atlas.

The Unicode character and CLDR short name are expression references only. The
renderer does not include, trace, sample, or transform Apple, Google, or other
vendor artwork. Havoc faces use a shared spherical construction, heavy ink
outline, upper-left studio light, violet/cyan/coral accents, and expression
geometry authored in the repository.

Run:

```bash
python3 scripts/build-social-assets.py --avatars
python3 scripts/build-social-assets.py --verify
```

Python 3, Pillow, and FFmpeg are the only local build requirements. Normal app
builds use the committed assets and do not run this generator.
