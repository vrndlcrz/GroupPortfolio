# Group Portfolio - The Classroom

A four-member interactive classroom portfolio built with **Java 17, Spring Boot 3.3.4, Three.js, GSAP, HTML, CSS, and JavaScript**.

## Run locally

From this directory, which contains `pom.xml`:

```powershell
.\mvnw.cmd spring-boot:run
```

Open [localhost:8080](http://localhost:8080). Stop with Ctrl+C. If that port is occupied:

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.arguments=--server.port=8082"
```

On macOS/Linux, use `./mvnw` instead of `.\mvnw.cmd`. The first run needs internet access to download Maven/dependencies. A JDK 17 or newer is required. Spring serves both the UI and API; opening the HTML directly does not run the backend.

## Find the right code

| Location | Responsibility |
| --- | --- |
| `src/main/java/com/aet/portfolio/` | Spring startup, REST controllers, models, services, configuration, and JSON storage |
| `src/main/resources/application.*` | Server settings and validated classroom configuration |
| `src/main/resources/data/members.json` | The four member portfolios, loaded at startup |
| `src/main/resources/static/js/core/` | API client and application wiring |
| `src/main/resources/static/js/classroom/` | Three.js room, camera, Zero-G, characters, experiences, and whiteboard |
| `src/main/resources/static/js/portfolio/` | Books, shared folder cover artwork, handwriting, doodles, and notebook music |
| `src/main/resources/static/js/phone/` | Phone shell, SpotiBai, and Labibi |
| `src/main/resources/static/js/intro/` | Intro timeline and its sound |
| `src/main/resources/static/js/shared/` | Visual theme, humor, and shared effects |
| `src/main/resources/static/css/` | Shared and feature styles, including the cartoon cursor |
| `src/main/resources/static/assets/` | Photos, fonts/licenses, cursors, borders, textures, audio, and videos |
| `src/main/resources/static/vendor/js/` | Third-party Three.js and GSAP libraries |
| `src/main/resources/static/dev/` | Standalone book and border preview pages |
| `src/test/` | Java backend and Node browser-logic tests |
| `scripts/verification/` | Current asset and browser checks |
| `docs/` | Architecture diagram, design notes, and historical verification |
| `var/data/` | Local guestbook and visitor counter; ignored by Git |
| `target/`, `.verification/` | Generated build and verification output; ignored by Git |

See the [code layout diagram](docs/architecture/code-layout.md) or its [standalone SVG](docs/architecture/code-layout.svg).

## Controls and features

- Drag/swipe or use WASD to look around; Shift looks faster; R resets the view.
- Click the front desk, then choose a member's notebook/folder/book/pad.
- Use page buttons, arrows, or horizontal swipes to turn pages.
- Back or Escape closes the current interaction and returns to the previous view.
- E or the Zero-G toolbar button floats the classroom's people, furniture, fixtures, bags, and props. The building shell stays fixed. Toggle again to restore exact poses.
- C opens the phone. SpotiBai plays local tracks; Labibi lets you roll and place a toy.
- Click the whiteboard to draw. Drawings stay in this browser's local storage.
- Hover/click Sir Sean for dialogue and the musical performance.
- Dark mode opens a plain black screen; click it or press Escape to leave.
- Fine-pointer devices use larger cartoon arrow/glove cursors. Text fields retain a text caret.

## Spring and data

- `PortfolioApplication` starts Spring Boot; it serves `static/index.html` and the assets.
- `ClassroomController` exposes `SiteProperties` from `application.yml` at `GET /api/site/classroom`.
- `MemberController` uses `MemberService` to expose `GET /api/members` and `GET /api/members/{id}`.
- `NoteController` validates requests and uses `NoteService` for `GET /api/notes`, `GET /api/members/{id}/notes`, and `POST /api/members/{id}/notes`.
- `VisitController` exposes GET/POST `/api/visit` through `CounterService`.
- `JsonFileStore` writes a temporary sibling file before replacing the saved JSON. Failed writes do not publish an unsaved note or increment the in-memory counter.
- Runtime files default to `var/data/notes.json` and `var/data/counter.json`. Set `DATA_DIRECTORY` or `site.storage.directory` for another writable directory. Older root-level JSON files are copied on first startup only when using the default directory and the new file does not exist.
- Member JSON and YAML are read at startup: restart Spring after changing them. Media belongs under `static/assets/` and is tracked in Git.
- Spring tests use `target/test-data/`, so test messages and visits do not alter real visitor data.
- JSON files are local single-process storage. Separate deployments do not synchronize them; durable hosting requires a persistent writable directory.

## Verify changes

```powershell
.\mvnw.cmd clean verify
node --test src/test/js/*.test.cjs
node scripts/verification/check-assets.cjs
```

Optional full browser smoke check, with the application running on port 8082:

```powershell
node scripts/verification/verify-ui.cjs
```

That script requires Playwright. Set `BASE_URL` for another address and `BROWSER_PATH` for another Chromium executable. See [verification instructions](scripts/verification/README.md).

Developer previews: [book engine](http://localhost:8080/dev/book.html) and [SVG borders](http://localhost:8080/dev/borders-test.html).

## Documentation

- [Code structure and Spring integration](docs/architecture/code-layout.md)
- [Repository cleanup and verification](docs/verification/reorganization.md)
- [Design notes](docs/design/DESIGN.md)
- [Original planning README](docs/history/README-legacy.md) - historical; some features and paths have changed

Keep Maven's standard `src/main` and `src/test` layout. Put new browser modules with their UI feature, shared assets in `assets/`, and runnable checks in `scripts/verification/`. Do not edit generated `target/` files or create a second clone inside this directory.
