# Havoc avatar catalog — art direction and provenance

## Deliverable

Create a broad, original selectable avatar catalog for Havoc onboarding:

- every fully qualified Unicode Emoji 17.0 entry in the twelve
  `Smileys & Emotion` subgroups beginning with `face-`;
- twelve additional premium-looking Havoc variants marked `exclusive`;
- transparent 256 × 256 WebP sources;
- transparent 96 × 96 WebP thumbnails;
- a compact thumbnail atlas;
- a crisp reusable lock badge; and
- a typed TypeScript manifest with accessible locked-state copy.

The normalized Unicode source list contains 119 standard expressions:

| Subgroup | Count |
| --- | ---: |
| face-smiling | 14 |
| face-affection | 9 |
| face-tongue | 6 |
| face-hand | 7 |
| face-neutral-skeptical | 16 |
| face-sleepy | 6 |
| face-unwell | 12 |
| face-hat | 3 |
| face-glasses | 3 |
| face-concerned | 27 |
| face-negative | 8 |
| face-costume | 8 |
| **Total standard** | **119** |
| **Original locked exclusives** | **12** |
| **Catalog total** | **131** |

## Prompt-like art brief

```text
Use case: stylized-concept
Asset type: mobile social onboarding avatar catalog
Primary request: create an original family of expressive Havoc 3D face
avatars, using Unicode names only as semantic expression references.
Style/medium: tactile clay-like spheres rendered from crisp vector-style local
primitives; playful neo-brutalist outline; polished but intentionally graphic.
Composition/framing: one centered face per square; consistent head size,
camera angle, crop, and transparent padding.
Lighting/mood: soft upper-left studio highlight, deep lower-right form shadow,
high-energy and mischievous.
Color palette: warm gold standard faces with restrained Havoc violet, cyan,
coral, lime, and yellow state accents. Premium variants may use chrome,
midnight, holographic, jeweled, electric, fire, and frozen treatments.
Materials/textures: smooth clay sphere, clean glossy highlights, thick ink
feature geometry.
Constraints: transparent background; readable at 48–96 CSS pixels; preserve
expression clarity; shared proportions; exact 12 exclusive variants; no text
inside the face art; no vendor assets.
Avoid: tracing, sampling, transforming, or imitating the exact silhouettes,
lighting, proportions, textures, or feature placement of Apple, Google,
Samsung, Microsoft, or other emoji vendors; generic navigation icons; baked
lock overlay; watermark.
```

## Generation method

`scripts/build-social-assets.py` uses deterministic Pillow drawing primitives:
radial sphere lighting, a shared heavy outline, locally authored eye and mouth
geometry, and named accessory functions. It does not call an image-generation
API. The runtime WebP files are generated directly from that code.

The twelve exclusives are repository-authored treatments:

1. Crowned Chaos
2. Liquid Gold
3. Jeweled Gaze
4. Electric Pulse
5. Fire Eyes
6. Chrome Mischief
7. Cosmic Spiral
8. Holographic Wink
9. Diamond Grin
10. Void Halo
11. Neon Venom
12. Royal Freeze

The faces remain unobscured in the source so the UI can blur only the image
inside its circle. `public/havoc-avatars/havoc-avatar-lock.webp` stays crisp
above that blur.

## Expression reference provenance

- Unicode Emoji 17.0 test data:
  <https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt>
- Unicode Emoji 17.0 charts:
  <https://www.unicode.org/emoji/charts-17.0/>
- Normalized repository source:
  `source-assets/avatars/unicode-face-catalog-17.0.tsv`

Unicode characters and CLDR short names are used as identifiers and semantic
expression references. No vendor image column from the Unicode charts was
downloaded or used by the renderer.

## Rebuild and verification

```bash
python3 scripts/build-social-assets.py --avatars
python3 scripts/build-social-assets.py --verify
```

The verifier checks catalog counts, unique ids, exact public-file coverage,
dimensions, alpha coverage, atlas geometry, exactly twelve exclusive manifest
entries, and the explicit `vendorArtworkUsed: false` provenance marker.
