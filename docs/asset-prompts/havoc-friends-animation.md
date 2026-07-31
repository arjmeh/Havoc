# Friends hero animation — processing and provenance

## Source

The product owner supplied:

```text
kling_20260731_VIDEO_Animate_al_1496_0.mp4
SHA-256: 11c151174d51e663b6b8a9dc1d88d432fd11e33e7ed4db0fa6d0c4394b4b763b
```

The untouched file is preserved at
`source-assets/social/kling_20260731_VIDEO_Animate_al_1496_0.mp4`.

Source media facts:

- 1292 × 712 pixels;
- 24 FPS;
- 3.041995 seconds;
- H.264 video plus AAC stereo audio;
- solid green field; and
- a source watermark in the lower-right margin.

## Runtime brief

```text
Use case: background-extraction
Asset type: animated page icon for “Havoc is better with friends”
Primary request: preserve the three expressive faces and their authored
movement while removing the green field, the source watermark, and all audio.
Composition/framing: keep all three faces visible, centered on a transparent
520 × 300 layout-stable canvas.
Motion: preserve the native 24 FPS timing; close the loop seam without a flash;
provide a representative static frame for reduced-motion users.
Constraints: local processing only, no generative edits, no watermark, no
green fringe, no audio stream, no layout shift.
```

## Local transformation

`python3 scripts/build-social-assets.py --video`:

1. validates the expected source dimensions before using the approved crop;
2. crops to `x=0, y=10, width=1292, height=640`, ending above the source
   watermark;
3. applies an FFmpeg soft chroma key around `#00FE04`;
4. applies green despill to partially transparent edge pixels;
5. scales the crop to 520 pixels wide and pads it to a transparent 520 × 300
   canvas;
6. decodes all 73 source frames with no audio mapping;
7. blends the final four frames toward the first frame, making the final frame
   identical to the first and eliminating the visible restart seam;
8. exports `public/havoc-friends-trio.webp`; and
9. exports frame 36 as
   `public/havoc-friends-trio-still.webp` for reduced motion.

The animated WebP format cannot contain an audio stream, so the runtime asset
is muted by construction. The source MP4 remains untouched and retains its
original audio for provenance.

## Runtime outputs

| File | Purpose |
| --- | --- |
| `public/havoc-friends-trio.webp` | Transparent 73-frame infinite loop |
| `public/havoc-friends-trio-still.webp` | Transparent reduced-motion still |
| `public/havoc-friends-trio.json` | Dimensions, timing, hash, crop, seam, and fringe audit |

The JSON metadata is regenerated from the source and records:

- `containsAudio: false`;
- `watermarkExcluded: true`;
- still-frame and sampled green-fringe ratios;
- pre-blend, post-blend, and post-WebP-encode loop-seam mean differences; and
- source SHA-256.

## Cost and rights note

No purchase, stock license, paid trial, cloud transcode, or metered media
service was used. The source animation remains product-owner supplied; this
pipeline documents only the local technical transformation and does not make a
separate ownership claim over the source imagery.
