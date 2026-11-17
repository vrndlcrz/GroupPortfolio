# Classroom visual theme

This is a seated, interactive group portfolio inside a Filipino classroom. The existing composition, member content, supplied artwork, Sean's speech, hit boxes, and look-only camera are preserved.

The visual language follows the supplied brief: handmade school stationery, chunky local Lilita One titles, local Patrick Hand captions, flat saturated paint, dark green outlines, hard offset shadows, and small deterministic tilts. The palette lives in `theme.css` and `window.Theme` in `theme.js`. Generated wood planks, abstract trading cards, name tags, and a dashed treasure trail belong to the tabletop; they never enter the interactive hit list.

Mapped artwork keeps its original material. Unmapped classroom paint uses cached toon materials and a shared nearest-filter three-step ramp. Inverted hulls share source geometry, use one ink material, cast no shadows, and are capped at 120 meshes, with instanced chairs and Sean prioritized.

The nostalgic treatment combines creation-time warm color grading with a pointer-transparent CSS wash, vignette, right-side light leak, one tiled grain image, and a local calendar date. The toolbar and book text sit above the filter. Opening a book reduces the background filter to 35% and adds a reduced warm paper wash behind its text. Reduced motion stops grain movement. Turning the filter off disables both overlays and grading.

Spring owns filter defaults under `site.theme`; the classroom endpoint exposes them additively. URL overrides are `?filter=off` and a numeric intensity from zero through one. Missing configuration uses built-in defaults.

Only original procedural motifs and OFL fonts were added. Existing supplied textures were not edited, recolored, or used as generation inputs. The original style reference images were not available in the continued chat; implementation follows the recovered written specification.
