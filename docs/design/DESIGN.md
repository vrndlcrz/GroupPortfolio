# Classroom visual theme

This is a seated, interactive group portfolio inside a Filipino classroom. The existing composition, member content, supplied artwork, Sean's speech, hit boxes, and look-only camera are preserved.

The visual language follows the supplied brief: handmade school stationery, chunky local Lilita One titles, local Patrick Hand captions, flat saturated paint, dark outlines, hard offset shadows, and small deterministic tilts. The palette lives in `static/css/theme.css` and `window.Theme` in `static/js/shared/theme.js`. Generated wood planks, abstract trading cards, name tags, and a dashed treasure trail belong to the tabletop; they never enter the interactive hit list.

Mapped artwork keeps its original material. Unmapped classroom paint uses cached toon materials and a shared nearest-filter three-step ramp. Inverted hulls share source geometry, use one ink material, cast no shadows, and are capped at 120 meshes, with instanced chairs and Sean prioritized.

The current warm classroom treatment uses procedural wood, saturated toon paint, golden lighting, and a sky/horizon prepared from the optional sunset image. Supplied artwork retains its mapped material. Reduced-motion preferences stop sky drift and simplify supported animations. Earlier photo-filter/date-stamp experiments are historical and are not part of the current theme contract.

Spring binds `site.theme.golden-intensity` and `site.theme.sky-drift`; the classroom endpoint exposes them as `theme.goldenIntensity` and `theme.skyDrift`. `Theme.configure()` validates/clamps browser settings and falls back to intensity 0.8 and enabled sky drift. Retired filter URL parameters do not alter this configuration.

Fine-pointer devices use large outlined arrow/glove SVG cursors from `static/assets/cursors/`, selected by `static/css/cursor.css`. Zero-G lifts classroom contents as shared assemblies, preserving invisible click targets and exact reset poses. The building shell and outside view stay anchored.

Only original procedural motifs and OFL fonts were added. Existing supplied textures were not edited, recolored, or used as generation inputs. The original style reference images were not available in the continued chat; implementation follows the recovered written specification.
