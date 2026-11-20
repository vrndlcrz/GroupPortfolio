# Current verification

Run these from the project root:

- `node scripts/verification/check-assets.cjs` checks HTML/CSS/member asset references and parses every browser JavaScript file.
- `node --test src/test/js/*.test.cjs` tests theme configuration, audio availability/playback, and whole-classroom Zero-G restoration.
- `.\mvnw.cmd clean verify` compiles/packages Spring and runs the Java tests, including failed-write recovery.
- `node scripts/verification/verify-ui.cjs` checks the running UI with Playwright: classroom startup, full-room floating/reset, all four portfolios, drawing, phone apps, dark mode, cursor CSS, developer previews, and no-WebGL fallback.

For browser checks, first start Spring on port 8082. Set `BASE_URL` to change it. Install Playwright in your development environment, or point `NODE_PATH` at an existing installation. The script uses `BROWSER_PATH` when supplied, Windows Edge when available, or Playwright's Chromium otherwise.

The browser script stubs visit registration and note loading and does not submit real guestbook messages. Java tests use `target/test-data/`. Screenshots and JSON results are generated in `.verification/`.

`docs/verification/legacy-scripts/` contains historical checks tied to older UI states. They are retained as records; use the commands above for current validation.
