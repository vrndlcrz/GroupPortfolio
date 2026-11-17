# Intro overlay verification

Implemented on feature/four-member-desk. Existing uncommitted work was preserved.

## Implementation

The intro replaces the old eye-blink loading overlay. It uses the existing Lilita One and Patrick Hand fonts, one GSAP timeline, and original Web Audio synthesis. The filter is temporarily stacked above the intro; its normal stacking returns when the intro is removed. No scene geometry, placements, speech, notebook audio object, or textures were changed.

The cached classroom request still uses the existing three-second timeout. Spring adds an intro record without removing or changing existing response fields. Missing intro fields use built-in defaults. No seen-state is stored.

| Timeline event | Start | Duration |
|---|---:|---:|
| Title fades in | 0 s | 0.8 s |
| Subtitle fades in | 0.4 s | 0.6 s |
| Title fades out after 2.2 s hold | 3.2 s | 0.8 s |
| Controls fade in | 4.0 s | 0.6 s |
| Controls and background fade out after 3 s hold | 7.6 s | 0.8 s |
| Finish and unlock | 8.4 s | — |

Reduced motion halves fade durations and removes translation; holds remain unchanged, for 6.8 seconds total. Skipping fades out over 0.4 seconds. A watchdog releases the site after 12 seconds even if the timeline stalls.

## Results

- Clean Spring startup succeeded on port 8081 using mvnw.cmd -o clean spring-boot:run -Dspring-boot.run.arguments=--server.port=8081. Port 8080 was already occupied, so its existing server was left running.
- mvnw.cmd -o test: **15 tests passed**, zero failures/errors, including default intro API fields and blank-title binding rejection. Offline mode used the cached Maven dependencies.
- Headless Edge: title/subtitle and controls screenshots show the grain, warm filter, vignette, and date stamp; reveal screenshot shows the classroom and the intro is removed. Captures were taken after approximately 1.5, 5, and 9 seconds following navigation completion; these are not precise navigation-start timestamps.
- Inspected actual GSAP children: durations, start offsets, easing and total 8.4 seconds match the table above. Reduced-motion timeline is 6.8 seconds and contains no Y translation.
- Before skip, scene and rig input were disabled. Direct hover/click handler calls performed zero raycasts.
- Holding W to skip did not change camera position or rotation, including through the fade. Position stayed [0, 4, 5.2]. A subsequent D press changed yaw while retaining that position.
- Click, key, and emulated touch skips removed the overlay. Click skip did not open a notebook or trigger speech. intro=off removed the overlay and enabled scene input.
- A 390-pixel touch viewport showed only the drag instruction, with no horizontal overflow. Tap skip passed.
- After the intro, Sean spoke the existing first line, all four member notebooks opened, and the laptop dialog opened. Drag changed yaw while keeping the seated position fixed; the back door remained absent from interactive objects.
- intro.enabled=false bypassed the overlay; an API 503 retained the default title. A deliberately paused timeline was removed by the watchdog. An injected timeline-construction exception also removed the overlay.
- AudioContext was suspended without activation and running after pointer activation and after a Space key gesture. An earlier W-key check remained suspended; blocked audio produced no uncaught errors. Audible sound quality, volume, and physical touch playback require a manual listen.
- No uncaught JavaScript errors were observed in normal flow. JavaScript syntax and git diff --check passed.

## Performance limitation

Headless Edge at 1280×800, cache disabled: approximately **56.9 FPS** in the sampled 3–8.4 second interval. The cold navigation recorded long tasks of 98, 466, 1521, and 59 ms, concentrated in startup. **The requirement of no tasks over 50 ms did not pass.** No claim is made that the intro is the source of those startup tasks; this run did not collect an equivalent baseline without the intro. Geometry/rendering performance changes are outside this feature's scope.

These metrics use requestAnimationFrame and PerformanceObserver, not manual DevTools inspection. Hard refresh was represented by reload with the browser cache disabled. Physical-device interaction and audible playback remain manual checks.

Evidence in the ignored .verification/intro directory: title.png, controls.png, reveal.png, mobile.png, maven.log, and spring-run.log.
