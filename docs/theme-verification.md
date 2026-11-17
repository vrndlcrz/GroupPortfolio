# Visual theme and photo filter — verification

Verified November 17, 2026 (Asia/Manila), on `feature/four-member-desk`, starting from `158868f6b5ec0db263c0ac297d4233f91127ce1d`.

## Implemented

- Shared CSS/JavaScript palette; local Lilita One and Patrick Hand WOFF2 fonts with OFL licenses and silent fallbacks.
- Cached toon paint, one shared three-step gradient map, and up to 120 geometry-sharing inverted hull outlines. Invisible click targets, mapped artwork, room surfaces, and tiny props are excluded as applicable. Outlines cast no shadows; instanced chair outlines retain batching.
- One-time procedural wood planks, dashed treasure trail and orange X, eight abstract cards, four member name tags, deterministic small prop tilts, layered canvas lettering, and bright cream louvres with an additive sprite. Existing light shafts and striped shadows remain.
- Flat outlined toolbar controls, paper labels, hard-edged book shadows, and removal of book blur/gloss. Stationery themes and supplied cover artwork remain.
- Creation-time warm grading plus CSS wash, vignette, right-side light leak, one tiled grain texture, reduced-motion support, a date stamp, reduced book intensity, and the 1.25 pixel-ratio cap when enabled.
- Validated `site.theme` configuration exposed additively in `/api/site/classroom`; safe frontend defaults, numeric URL overrides, and complete filter disabling.

## Verified results

| Check | Result |
|---|---|
| Windows equivalent of `./mvnw clean spring-boot:run` | Started successfully on port 8080 |
| `mvnw.cmd test` | 14 tests passed; no failures or errors |
| `node --test src/test/js/theme.test.cjs` | 5 tests passed |
| API configuration | New theme fields returned alongside existing classroom fields |
| Binding validation | Both negative and greater-than-one intensities reject startup binding; zero and one accepted |
| Pointer interactions | Sean speaks; all four correct portfolios open; page turns complete; laptop opens its existing dialog |
| Camera and door | Keyboard look test keeps camera position fixed; door absent from interactive objects; camera/control source unchanged |
| Filter variants | Off, 0.4, and default 0.7 verified; off hides the entire overlay, restores ungraded colors, and removes the filter pixel-ratio cap |
| Readability | Sampled body text in all four books uses ink against light paper: 11.86:1 against cream; book wash sits behind text |
| Reduced motion and mobile | Grain animation stops; 390px viewport has no horizontal page overflow; date remains within viewport |
| Optional failures | Classroom API forced to 503 and all WOFF2/TTF requests forced to 404: scene starts with defaults and no uncaught page errors; date override also verified |
| Asset preservation | No changes under supplied `static/assets/`; mapped materials retain their textures |
| Rendering resources | Outline count capped at 120; hulls share source geometry and cast no shadows; no postprocessing added |
| Browser errors | None in normal before/after captures or interaction checks |
| Whitespace check | `git diff --check` passed |

The missing-font test caught existing uncaught canvas-font promises; these now fail silently. Visual inspection caught an outline on Sean's invisible hit box; invisible materials are now excluded and covered by a regression test.

## Performance and limitations

Matched final captures used headless Edge with **SwiftShader software rendering**, a 1440×900 viewport, and device scale 1.5. Each run used a fresh browser context; routing disables the HTTP cache. Before captures serve the original frontend from Git without modifying this checkout.

| Measurement | Before | After |
|---|---:|---:|
| Average requestAnimationFrame FPS, approximately four seconds | 1.01 | 0.92 |
| Longest observed task, including startup | 4,030 ms | 4,420 ms |
| Default-view draw calls | 160 | 264 |
| Renderer geometry count | 79 | 82 |

**The 30 FPS target was not achieved in this software-rendered environment and remains unverified on a weak laptop with hardware graphics.** These timings show a small software-rendering regression and do not establish lag-free interaction on physical hardware. Existing shadow throttling, hover scheduling, book caching, covered-scene rendering throttling, and camera logic remain intact. No manual DevTools profiling or physical-device testing was performed. Long tasks were collected through PerformanceObserver rather than the DevTools UI.

The browser harness disables GSAP lag smoothing only while checking completed page turns: otherwise multi-second software frames stretch its animation clock. Production animation timing is unchanged. Normal runtime error checks exclude deliberately induced network failures in the optional-assets test; that test checks uncaught page errors and successful startup.

Contrast measurements cover computed body text and the cream paper surface, not every raster pixel, decorative heading, or typography embedded in supplied images. Original style-reference images were unavailable; the recovered written specification supplied the visual direction.

## Evidence and reproduction

Artifacts are local and ignored by Git:

- `.verification/before/` and `.verification/after/`: default, table, window, closed book overlay, fully open book, timing JSON, and body contrast JSON.
- `.verification/after/`: additional filter-off, filter-0.4, default-filter, and mobile screenshots.
- `.verification/interactions.json`, `.verification/fallbacks.json`, and `.verification/maven-test.log`.

With the app running, install Playwright locally using `npm install --prefix .verification --no-package-lock playwright`, set `NODE_PATH` to the absolute `.verification/node_modules` directory, then run:

```text
node docs/verify-theme.cjs before
node docs/verify-theme.cjs after
node docs/verify-interactions.cjs
node docs/verify-fallbacks.cjs
node --test src/test/js/theme.test.cjs
```

The scripts default to the installed Windows Edge path; `BROWSER_PATH` can override it. Run timing captures sequentially. Existing Spring tests create ignored runtime notes/counter data; do not run them against production data.

Font sources: [Lilita One](https://github.com/google/fonts/tree/main/ofl/lilitaone) and [Patrick Hand](https://github.com/google/fonts/tree/main/ofl/patrickhand). Both licenses are included beside the fonts. All new tabletop motifs are procedural original drawings; no reference images were used as textures.
