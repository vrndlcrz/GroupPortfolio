# AET Group Portfolio: "The Messy Desk"

**Subject:** Advanced Emerging Technologies (AET)
**Team size:** 5 members
**Stack:** HTML, CSS, JavaScript (Three.js + GSAP) on the frontend, Java Spring Boot on the backend
**Runs on:** `http://localhost:8080` (no database, no hosting)

---

## 1. Concept

A 3D website that shows a **messy student desk**. On the desk are **5 folder cases**, one per member, each labeled with the member's name. Opening a folder pulls out a **clear-book portfolio**, like the school portfolios we all had, with a bright cover, a photo, a name and the subject title.

Inside each clear book, every page has its **own hand-drawn style border** (wavy, blobs, vines, dripping, bows and stars), like the notebook border references. The pages hold each member's hobbies, skills, projects and a humor page.

**Humor is the theme.** The desk is chaotic on purpose, the file names are jokes, the skill levels are jokes, and clicking props triggers small surprises.

**One-line pitch:** *"A group portfolio you can actually touch: 5 members, 5 clear books, 1 very messy desk."*

### Goals
- Meet the professor's requirement to add humor.
- Show emerging-tech skills: 3D web (Three.js), animation (GSAP), and a REST backend (Spring Boot).
- Give every member an equal, personalized portfolio.
- Run fully offline on a laptop with one command.

---

## 2. User Flow

```
[Loading screen] → [Desk scene] → [Hover folder] → [Click folder]
        → [Camera zoom + clear book rises] → [Cover page]
        → [Flip through pages 1..6] → [Back cover]
        → [Back to desk] → [Pick another member]
```

| Step | What the user sees | What happens behind the scenes |
|---|---|---|
| 1. Loading | Fake loading bar: "Loading personality... 99%" (stuck for a moment) | Frontend calls `GET /api/members` and `POST /api/visit` |
| 2. Desk | Camera looks over the desk, 5 labeled folders, sticky notes, coffee cup, laptop | Three.js builds the scene using member names from the API |
| 3. Hover | Folder lifts slightly, tooltip shows a joke | Raycasting detects the hovered object |
| 4. Click | Camera zooms in, the folder opens, the clear book slides out | GSAP animates the camera and folder; `GET /api/members/{id}` loads the data |
| 5. Cover | Orange (or member-colored) cover with title, photo, name, section, subject | Cover is generated from the member's JSON |
| 6. Flip | Pages turn with a 3D flip, each with a different border | Page-flip engine reads the `pages` list |
| 7. Guestbook | Visitor types a note, a sticky note appears on the desk | `POST /api/members/{id}/notes` |
| 8. Back | Book closes, camera returns to the desk | GSAP reverses the animation |

**Controls:** click or tap to open, drag or click page edges to flip, arrow keys to navigate, `Esc` to go back to the desk.

---

## 3. Inside Pages (per member)

Each portfolio has a **cover**, **6 inside pages** and a **back cover**. Every page uses a different SVG border.

| Page | Title | Content | Border style |
|---|---|---|---|
| Cover | "PORTFOLIO" | Member photo, name, section, subject: *Advanced Emerging Technologies*, funny tagline | Solid color with a spine strip (like the reference) |
| 1 | About Me | Short intro, age or year, course, motto | Wavy outline (pink) |
| 2 | Hobbies | List of hobbies with small doodles or icons | Colorful blobs (orange and red) |
| 3 | Skills | Skills with funny proficiency labels | Vines and flowers |
| 4 | Projects | 2 to 3 projects with a short description and a screenshot | Dripping pink and purple |
| 5 | Fun Facts / Roast Me | Random facts, "things my friends say about me" | Bows and stars |
| 6 | Contact / Goals | Email or social handle, goals in tech | Simple dotted frame |
| Back cover | "The End (Please Clap)" | Team credits and a thank-you line | Matches the cover color |

**Design rules**
- Borders are **SVG files** (`assets/borders/`), so they scale cleanly and can be recolored.
- Each member picks their own `coverColor` and an accent color.
- Fonts: one bold display font for titles (cover style) and one readable font for body text.
- Keep text short so pages don't overflow. Aim for about 60 words per page.

---

## 4. Humor Ideas

### On the desk
- Folder labels: `FINAL_v7_REALLYFINAL_dontopen`, `Do Not Open (Seriously)`, `Homework (Unfinished)`.
- A sticky note says "Do not touch". Clicking it makes the nearest folder shake.
- Clicking the coffee cup spills it and plays a sound.
- The laptop screen shows a fake error: "Motivation.exe has stopped working".
- A tiny desk calendar has every day circled as "DEADLINE".

### On the portfolios
- **Cover taglines** (one per member): "Emerging technologies, emerging deadlines", "Powered by coffee and panic", "99% skill, 1% luck, 100% procrastination".
- **Skill labels:**
  - Ctrl+C, Ctrl+V: Expert
  - Googling error messages: Advanced
  - Turning it off and on again: Master
  - Explaining my code to a rubber duck: Certified
- **Hobby not found (404):** a joke page for anyone who writes "sleeping" as a hobby.
- **Terms & Conditions page:** one page of tiny text nobody will read, with a joke hidden at the bottom.
- **Fake loading bar** that stalls at 99%.
- **Roast Me button:** shows a random friendly roast, such as "Has 47 tabs open and uses none of them".

### Backend-powered jokes
- **Visitor counter:** "You are visitor #12. Please go touch grass."
- **Guestbook as sticky notes:** visitor messages land on the 3D desk.

### Easter eggs
- Press the **Konami code** and the desk starts floating.
- Click the cover photo 5 times and the member's face spins.
- Type `sudo` in the guestbook and get "Nice try."

> Rule: keep jokes friendly. No jokes that target a person unkindly or a protected group, and every member approves their own page.

---

## 5. New Technical Structure

### 5.1 Architecture

```
Browser (HTML, CSS, JS, Three.js, GSAP)
        │  fetch() → JSON
        ▼
Spring Boot on http://localhost:8080
   ├─ Serves the website from /static
   ├─ REST API (members, notes, visit counter)
   └─ Reads/writes JSON files (no database)
```

- **Frontend** draws the 3D desk, the folders, the clear book and all animations.
- **Backend (Spring Boot)** serves the files, returns member data, saves guestbook notes and counts visits.
- **Data** lives in JSON files, so there is no database to set up.
- Because Spring serves the frontend itself, there are **no CORS problems**.

### 5.2 Folder structure

```
group-portfolio/
├── pom.xml
├── README.md
├── .gitignore
├── notes.json                      ← guestbook storage (git-ignored)
├── counter.json                    ← visitor counter (git-ignored)
├── docs/
│   ├── sketches/
│   └── presentation/
└── src/main/
    ├── java/com/aet/portfolio/
    │   ├── PortfolioApplication.java
    │   ├── controller/
    │   │   ├── MemberController.java
    │   │   ├── NoteController.java
    │   │   └── VisitController.java
    │   ├── model/
    │   │   ├── Member.java
    │   │   ├── PageContent.java
    │   │   ├── Skill.java
    │   │   └── Note.java
    │   └── service/
    │       ├── MemberService.java     ← loads members.json
    │       ├── NoteService.java       ← reads/writes notes.json
    │       └── CounterService.java    ← reads/writes counter.json
    └── resources/
        ├── application.properties
        ├── data/
        │   └── members.json
        └── static/
            ├── index.html
            ├── css/
            │   ├── style.css
            │   └── book.css
            ├── js/
            │   ├── api.js             ← all fetch() calls
            │   ├── scene.js           ← Three.js desk and folders
            │   ├── book.js            ← cover and page flip
            │   ├── humor.js           ← easter eggs and sounds
            │   └── main.js            ← connects everything
            └── assets/
                ├── borders/           ← SVG borders
                ├── photos/            ← member photos
                ├── covers/
                └── sounds/
```

### 5.3 API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/members` | List the 5 members (id, name, folder label, cover color) |
| GET | `/api/members/{id}` | Full portfolio: cover, pages, skills |
| GET | `/api/members/{id}/notes` | Read guestbook notes |
| POST | `/api/members/{id}/notes` | Add a guestbook note |
| POST | `/api/visit` | Increase and return the visitor count |

### 5.4 Data contract: `members.json`

Agree on this shape as a team before coding. It connects the backend and the frontend.

```json
[
  {
    "id": 1,
    "name": "Joshua Deliva",
    "section": "BSIT-1A",
    "subject": "Advanced Emerging Technologies",
    "tagline": "Emerging technologies, emerging deadlines",
    "folderLabel": "FINAL_v7_REALLYFINAL_dontopen",
    "photo": "assets/photos/member1.jpg",
    "coverColor": "#FFA500",
    "pages": [
      {
        "title": "About Me",
        "content": "Short intro here.",
        "border": "wavy-pink.svg"
      },
      {
        "title": "Hobbies",
        "content": "Hobby list here.",
        "border": "blobs-orange.svg"
      }
    ],
    "skills": [
      { "name": "HTML/CSS", "level": 80, "funnyLabel": "Can center a div (sometimes)" }
    ]
  }
]
```

Use the same keys for all 5 members. Validate the file at jsonlint.com before every commit, because one typo breaks the whole site.

### 5.5 Data storage (no database)

| Data | Where | Notes |
|---|---|---|
| Member info | `src/main/resources/data/members.json` | Read-only, loaded at startup |
| Photos, borders, sounds | `static/assets/` | Drop files in, reference by name |
| Guestbook notes | `notes.json` (project root) | Spring reads and writes it, survives restarts |
| Visitor counter | `counter.json` | Resets if the file is deleted |

### 5.6 Frontend libraries

| Library | Use |
|---|---|
| Three.js | 3D desk, folders, lighting, raycasting |
| GSAP | Camera zoom, folder open, shake, spill animations |
| StPageFlip or custom CSS 3D | Page-flip effect in the clear book |
| Howler.js (optional) | Sound effects |

**Fallback if Three.js is too heavy:** build the desk with CSS 3D (`perspective`, `transform: rotateY()`), the same technique as the first reference screenshot.

---

## 6. How to Run

**Requirements:** Java 17 or newer, Maven (or the included `mvnw` wrapper), Git, and an IDE such as IntelliJ IDEA or VS Code.

```bash
git clone <your-repo-url>
cd group-portfolio
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

Then open **http://localhost:8080**.

If port 8080 is busy, add `server.port=8081` to `application.properties`.

---

## 7. Team Roles

| Member | Role | Main tasks |
|---|---|---|
| 1 | Project lead + backend | Repo, Spring Boot setup, member API, JSON loading |
| 2 | Backend + integration | Guestbook, counter, `api.js`, connecting everything |
| 3 | 3D scene | Desk, 5 folders, hover, camera zoom, sticky notes |
| 4 | Book engine | Cover, page flip, loading pages from the API |
| 5 | Design + humor | SVG borders, covers, jokes, sounds, testing |

**Everyone** fills in their own section of `members.json`, adds their photo, picks their cover color and approves their own jokes.

---

## 8. Timeline (adjust to your deadline)

| Week | Dates | Goals |
|---|---|---|
| 1 | Oct 23 to 30 | Confirm concept with the professor, set up repo and Spring Boot, agree on the JSON shape, sketch screens, collect content and photos |
| 2 | Oct 31 to Nov 6 | `/api/members` working, 3D desk with 5 clickable folders, one flip-book portfolio loading from the API |
| 3 | Nov 7 to 13 | All 5 portfolios filled in, a different border on every page, guestbook, counter, humor features |
| 4 | Nov 14 to 20 | Test on other laptops, fix bugs, rehearse the presentation |

---

## 9. Milestone Checklist

- [x] Everyone can run the project on their own laptop (`./mvnw spring-boot:run`)
- [x] `/api/members` returns the JSON
- [x] Desk shows 5 labeled folders
- [x] One portfolio opens and flips pages
- [x] Every page has a different border (6 custom SVG borders)
- [x] All 5 portfolios have full 6-page structures, avatars, and humor
- [x] Guestbook notes appear on the desk (`notes.json` + real-time 3D sticky notes)
- [x] Visitor counter works (`counter.json` + `POST /api/visit`)
- [x] At least 5 humor features work (10 interactive jokes + Web Audio sounds)
- [x] README explains how to run it
- [x] Backup screen recording saved

---

## 9.1 How It Works (Presentation Talking Points)

Read these 7 points during your class presentation:
1. **Architecture:** The app is built with a lightweight Java 17 Spring Boot backend serving a client-side 3D web experience in plain HTML5, CSS3, and modern JavaScript.
2. **Zero-Database JSON Storage:** Member data is loaded from `src/main/resources/data/members.json`, while visitor notes and counter persist in `notes.json` and `counter.json` with synchronized file I/O.
3. **The 3D Messy Desk:** Three.js renders a student desk with raycasted interactive folders, a spilled coffee mug, a "Do not touch" sticky note, a laptop with mock errors, and a deadline calendar.
4. **Authentic Clear-Book Flip Engine:** Clicking any folder triggers a GSAP camera zoom and reveals a plastic-sheened clear-book portfolio with 3D page turns, drag/arrow navigation, and spine stitching.
5. **Original Scalable SVG Borders:** Every single inside page features a unique, recolorable hand-drawn SVG border (wavy pink, blobs, vines, dripping paint, bows/stars, dotted frame) framing readable text.
6. **Real-time Desk Guestbook:** Visitors can leave notes with HTML-sanitized input and 120-character limits; submitted notes immediately pin themselves as colorful 3D sticky notes on the desk without reloading.
7. **Humor & Emerging Tech:** Packed with easter eggs, including a fake 99% stalling loader, Konami code anti-gravity desk float, synthesized Web Audio sounds, and friendly developer roasts.

---

## 10. Git Workflow

- `main` holds only working code.
- Each member works on their own branch, such as `feature/desk-scene` or `feature/book-engine`.
- Merge by pull request, and have one teammate review before merging.
- Add `notes.json` and `counter.json` to `.gitignore` to avoid conflicts.
- Meet briefly 2 to 3 times a week and update the checklist above.

---

## 11. Risks and Fixes

| Risk | Fix |
|---|---|
| Different Java versions | Everyone uses Java 17, noted in this README |
| Port 8080 already in use | Change `server.port` |
| JSON typo breaks the site | Validate before committing |
| Merge conflicts | Separate files and branches per role |
| 3D scene lags on weak laptops | Keep models simple, compress photos under 300 KB, use the CSS 3D fallback |
| Too ambitious | Finish the full flow for 1 member first, then repeat for all 5 |
| Presentation day failure | Start the server early and keep a screen recording as backup |

---

## 12. Presentation Plan

1. Start the server before class and open the site full screen.
2. One member introduces the concept (about 1 minute).
3. Each member opens their own folder live and shows their portfolio.
4. Show the guestbook and visitor counter working.
5. Explain the tech stack: Three.js, GSAP and Spring Boot.
6. Keep a backup recording in case something breaks.
