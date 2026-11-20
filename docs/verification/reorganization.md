# Repository reorganization and checks

Reviewed on 21 November 2026 against branch `UpdatedPortfolio`, starting from commit `594d786`.

## Structure changes

- Preserved Maven's standard Java, resource, and test directories.
- Grouped browser scripts into `core`, `classroom`, `portfolio`, `phone`, `intro`, and `shared` feature folders.
- Moved Three.js/GSAP into `static/vendor/js` and fonts/licenses into `static/assets/fonts`.
- Moved standalone book/border previews into `static/dev`; updated their asset base paths.
- Separated shared folder artwork into `portfolio/folder-art.js`, making Vernie's standalone preview independent of the classroom renderer.
- Grouped design, architecture, history, and historical verification documentation under `docs`.
- Replaced the old verification entry points with maintained asset and browser checks under `scripts/verification`; retained the older scripts as historical records.
- Moved the older nested clone to `C:\workspace\GroupPortfolio-backup-d4625ae`, preserving its Git history and files.
- Moved existing guestbook and counter files into ignored `var/data`. Tests now use `target/test-data`.
- Added [Mermaid architecture documentation](../architecture/code-layout.md), a [standalone SVG](../architecture/code-layout.svg), and a [PNG diagram](../architecture/code-layout.png).

## Behavior changes and fixes

- Zero-G now includes the classroom's people, chairs, teacher, wall fixtures, curtains, fans, bags, wrappers, basketball, banner, and desk. Composite fixtures retain their artwork and click targets together. The building shell remains fixed.
- Switching gravity off restores exact saved transforms and material state. Rapid toggling completes the previous reset before taking a new snapshot. Reduced-motion users receive a simple lift and immediate reset.
- Added large cartoon arrow and glove cursors for fine-pointer devices, with text carets retained for editable fields.
- Fixed the Windows Maven wrapper's null-array access when the Maven home directory has no link target.
- Notebook audio availability checks have a three-second timeout; active playback failures disable repeated attempts while obsolete callbacks cannot disable newer playback.
- Teacher hover dialogue now uses the Spring-provided classroom configuration instead of a duplicate hardcoded list.
- Failed note writes no longer leave an unsaved note in the in-memory cache.
- Failed visitor-count writes return an HTTP error and leave the previous in-memory count intact.
- JSON writes use a sibling temporary file followed by replacement, retaining the previous file on serialization failure.
- Dark mode and Zero-G safely decline when the browser is using the no-WebGL fallback.

## Validation

| Check | Result |
| --- | --- |
| Fresh Java compilation and backend tests | 31 tests passed, zero failures/errors |
| JavaScript tests | 13 tests passed, zero failures |
| Static references and browser JavaScript parsing | 87 asset references valid; all browser JS parsed |
| Browser UI smoke checks | Classroom, whole-room Zero-G/reset, four portfolios, whiteboard persistence, phone apps, dark mode, cartoon cursor, standalone previews, and no-WebGL fallback passed |
| Browser runtime/network errors | No page errors or failed HTTP responses in the successful smoke run |
| Diagram | SVG rendered and PNG visually inspected |

## Local build limitation

- The clean verification run compiled the application and passed all 31 Java tests, then stopped at JAR packaging because the locally cached `maven-jar-plugin:3.4.2` lacks its POM/transitive dependencies (`org.codehaus.plexus.archiver.FileSet` was unavailable).
- A workspace-local copy of the Maven cache was used because the execution environment prevented Java from accessing part of the original user cache during clean compilation.
- Browser checks ran the freshly compiled Spring application directly on port 8082 with isolated verification data, avoiding changes to the real guestbook/counter.
- An executable JAR was not validated in this environment. Restore/download the missing Maven plugin dependencies, then run `.\mvnw.cmd clean verify` to complete that check.

Current commands and prerequisites are in [scripts/verification/README.md](../../scripts/verification/README.md). Generated screenshots/results are ignored under `.verification/`.
