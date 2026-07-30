# Havoc source asset archive

This folder contains the original inputs used to create the optimized assets in
`public/`. Keep these files unchanged. Create new derived files rather than
overwriting the originals.

## Product source

| File | Purpose |
| --- | --- |
| `product/Havoc-PRD.pdf` | Product requirements and feature context |

## Visual references

| File | Purpose |
| --- | --- |
| `references/original-product-ui.png` | Original multi-screen UI reference |
| `references/fire-emoji-reference.jpg` | Approved Apple-style fire reference |
| `references/controller-emoji-reference.png` | Approved controller reference |
| `references/joystick-emoji-reference.jpg` | Approved joystick reference |

## Motion sources

| File | Derived runtime assets |
| --- | --- |
| `motion/controller-fire-source.gif` | `public/havoc-controller-fire-intro-v6.gif`, `public/havoc-controller-fire-loop-v8.gif`, and shatter artwork |
| `motion/controller-fire-source.mp4` | Earlier animated-flame exploration and timing reference |
| `motion/joystick-source.gif` | `public/havoc-joystick-transparent.webp` and `public/havoc-joystick-still.png` |
| `motion/rocket-launch-source.mp4` | `public/havoc-rocket-launch.webp`, `public/havoc-rocket-cutout.png`, and `public/havoc-rocket-flame-launch.webp` |

## Editing rules

- Runtime files belong in `public/`; original source files belong here.
- Keep transparency when exporting animation assets.
- Avoid baking page movement into an asset when CSS controls the same movement.
- Declare final image dimensions in JSX to prevent layout shift.
- Optimize derived assets before shipping, but never replace the source archive
  with the optimized version.
- Run `npm test` and visually review the 378px phone after asset changes.
