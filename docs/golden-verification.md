# Golden classroom verification

## Result and outstanding asset

Implemented on feature/four-member-desk. The supplied sunset is visible in the chat, but no readable local file was available at src/main/resources/static/assets/textures/window-sunset.jpg. The live window currently uses the requested golden gradient fallback. Place the original photo at that path and rebuild to enable its treatment. No substitute photograph or generated artwork was installed.

The exact sunset's cloud colors, ships, crane, bird, and silhouette framing remain unverified. The requested rename/restore test could not be performed on an absent photo. Missing-file fallback and the successful image-processing path were tested separately; the latter used an explicitly synthetic fixture stored only in ignored verification output.

## Changes

- Removed the nostalgic filter element, stylesheet, date, vignette, light leak, grain canvas, wash, URL overrides, grading function, and filter-dependent pixel ratio. The existing stationery paper texture is preserved inside notebooks.
- Golden palette and warm brown outlines on scene/UI chrome; notebook page variables are locally pinned to their previous palette. Cover textures, handwriting rules, notebook audio, intro timeline, object layouts, camera logic, and Sean's dialogue are unchanged.
- New validated theme fields: goldenIntensity=0.8 and skyDrift=true. Old filter fields are absent from the API. An optional static-photo endpoint returns 204 when the image is absent, avoiding a browser 404 console error; invalid/missing images produce one debug message and cached fallback textures.
- One 1024 shadow map, warm hemisphere/key/fill lights, creation-time vivid colors and warm fog, 60 dust points, existing bounded shadow refresh and covered-scene throttling.
- Window adds sky, horizon, and additive glow planes, plus one instanced outline draw for all existing slats. Removed the old glow sprite: net default-view draw calls increased by three (268 to 271).
- Photo processing is cached and chunked through idle callbacks. Maximum long side 1024 pixels; six channel levels; warmth/saturation; darkest-pixel dilation restricted to the lower 12%. SKY texture drifts and both layers use small yaw parallax without per-frame allocation. The horizon texture remains static. Mirrored offsets wrap over two repeats to avoid a discontinuity.

## Verification

| Check | Result |
|---|---|
| Clean Spring startup | Passed on port 8082, using mvnw.cmd -o clean spring-boot:run -Dspring-boot.run.arguments=--server.port=8082 |
| Spring tests | 16 passed, zero failures/errors, including new theme defaults, bounds, intro, and optional image response |
| JavaScript tests | 11 passed: theme and notebook-audio regressions |
| DOM and requests | Zero retro-filter/date/vignette/leak nodes and no filter.css request |
| Palette/filter | Theme.grade removed; no global CSS filter or warm wash remains |
| Screenshots | Default, window fallback, table, open book; manually inspected golden UI and retained paper styling |
| Image pipeline fixture | 1736×2100 test image downscaled to 847×1024; split into 901px sky and 123px horizon; silhouette edge pixels detected only in horizon |
| Drift and parallax | Synthetic screenshots before/after a 10-second wait; sky offset changed, horizon offset stayed zero; different yaw offsets applied to both planes |
| Motion settings | Reduced motion and sky-drift disabled each stopped offset changes |
| Missing image | Fallback appeared, with no failed network requests or console errors on final Spring server |
| Intro | Brown background rgb(31,18,6); skip unlocked input without changing seated camera position/rotation; timings source untouched |
| Interactions | Sean spoke; all four notebooks opened; laptop opened; back door stayed unregistered |
| Controls | WASD and drag changed view while position remained [0,4,5.2] |
| Notebook interiors | Existing CSS page/paper and handwriting colors preserved via local variables; supplied texture files untouched |

Browser checks used installed headless Edge at 1280×800. Routing disabled cache for source and interaction checks; this represents cache-disabled navigation rather than a manual Ctrl+Shift+R. Some browser checks served the current source files through test-only Playwright routes while the server was rebuilding. No runtime debug hooks were added to production source.

## Performance and limits

| Sample | Before | After |
|---|---:|---:|
| Steady-state requestAnimationFrame FPS (after 3 seconds) | 9.28 | 58.69 |
| Longest navigation task | 1856 ms | 258 ms |
| Default-view draw calls | 268 | 271 |

These are sequential headless samples, not a controlled hardware benchmark: GPU/shader cache warming and host load may account for part of the difference. They do not prove performance on a weak laptop. Metrics came from requestAnimationFrame and PerformanceObserver, not manual DevTools UI inspection.

The interaction run recorded a longest task of **804 ms** across Sean/notebook/laptop checks. **The no-click-task-over-50-ms requirement did not pass.** Existing click-performance code was preserved. The actual sunset path still needs visual and performance verification with the real file.

Evidence: .verification/golden contains before/after metrics, screenshots, click tasks, the explicitly synthetic pipeline fixture, and Maven/startup logs. These files are ignored by Git.

## Actual sunset installed

The user supplied the local source folder. Its preview.webp (990×1204) was converted to window-sunset.jpg and installed in source and runtime resources. The running app on port 8083 reports windowSource=photo with no uncaught JavaScript errors. Actual window screenshot: .verification/golden/actual-sunset.png.
