# Friends animation source

`kling_20260731_VIDEO_Animate_al_1496_0.mp4` is the untouched source file
supplied by the product owner for the friends-onboarding hero.

Do not edit or replace the source file in place. Run
`python3 scripts/build-social-assets.py --video` from the repository root to
rebuild the transparent runtime animation and reduced-motion still.

The build:

- decodes the source at its native 24 FPS;
- crops before keying so the lower-right source watermark is never present in
  a runtime frame;
- removes the green field with a soft matte and edge despill;
- preserves a transparent 520 × 300 canvas for layout stability;
- blends the final four frames into the opening frame for a clean loop seam;
- exports an animated WebP with no audio track; and
- exports a representative still WebP for reduced-motion users.

The derived files belong in `public/`; this archive remains the provenance
source.
