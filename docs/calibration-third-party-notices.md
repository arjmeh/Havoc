# Calibration third-party notices

This file records the third-party browser-vision artifacts committed for
Havoc's on-device facial-expression/game-face calibration.

## MediaPipe Tasks Vision 1.0.0

- Package: `@mediapipe/tasks-vision@1.0.0`
- Publisher: MediaPipe / Google
- License: Apache License 2.0
- License copy: [`docs/licenses/Apache-2.0.txt`](./licenses/Apache-2.0.txt)
- Package tarball:
  `https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-1.0.0.tgz`
- Upstream license:
  `https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE`
- Web guide:
  `https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js`
- Privacy notice:
  `https://developers.google.com/edge/mediapipe/legal/tos`

The following files are copied without modification from the official
`@mediapipe/tasks-vision@1.0.0` npm package so the browser does not depend on a
runtime CDN:

| Local file | Bytes | SHA-256 |
| --- | ---: | --- |
| `public/calibration-vision/vision_wasm_internal.js` | 323343 | `e2da04fe2ab9f58eb2aeb8f8724c80ad8919d31d7f5fb99057565879f05f51ca` |
| `public/calibration-vision/vision_wasm_internal.wasm` | 11532084 | `c266c65f3789bea74ab12dd6609edc96c68655da4540d6097d0732d8be80b742` |
| `public/calibration-vision/vision_wasm_nosimd_internal.js` | 323146 | `3019218e99d08d95cf9710245e6785aeb68520cd703793e67ff1c583920d6345` |
| `public/calibration-vision/vision_wasm_nosimd_internal.wasm` | 10815273 | `850d2d7b318c017e71c11b712947df65088e966de3453b9cdf263556d8ae47a6` |

## MediaPipe Face Landmarker model

- Asset: `public/calibration-vision/face_landmarker.task`
- Publisher: MediaPipe / Google
- Distribution/license context: official MediaPipe model distributed with the
  Apache-2.0 MediaPipe project; retain this notice and the upstream license.
- Official model URL:
  `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`
- Model cards:
  `https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf`
  and
  `https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf`
- Bytes: 3758596
- SHA-256:
  `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

Havoc passes camera frames directly from the local `HTMLVideoElement` into
MediaPipe and neither serializes nor sends those frames to a Havoc server.
MediaPipe's current notice says input processing happens on-device and input
data is not sent to Google, while API utilization/performance metrics may be
collected. Product privacy copy and consent handling must remain aligned with
that upstream notice.
