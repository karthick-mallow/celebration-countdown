# Celebration Countdown

A full-screen countdown to 00:00 on birthdays, anniversaries, weddings, festivals and more, with confetti when it hits zero.

**Landing page:** https://karthick-mallow.github.io/celebration-countdown/
**App:** https://karthick-mallow.github.io/celebration-countdown/app/

## Structure
| Path | What |
|---|---|
| `index.html`, `landing.css`, `landing.js` | Landing page (live countdown to tonight's midnight, 10-second demo, occasion links) |
| `app/index.html`, `app.js`, `styles.css` | The countdown app |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and install, shared by both |
| `404.html` | Not-found page; forwards stray share links to the app |

Links: `app/?new=<occasion>` opens a blank setup with that occasion picked. Share links look like `app/?o=…&n=…&d=…&tz=…`. Older links at the site root (`/?n=…&d=…`) are redirected to `app/`.

## Features
- Countdown to midnight in **any time zone** (DST-safe). Viewers elsewhere see their own local time too.
- **Shareable links**: `?n=Aarav&d=2025-10-20&tz=Asia/Kolkata` (`a=0` hides age). No backend, no data stored server-side.
- Full-screen stage mode (button or `F`), cursor auto-hides, `Esc` exits.
- Last 60 seconds: seconds-only, centred. Confetti + "Happy Birthday" at zero, for the whole day.
- 10-second rehearsal mode.
- Installable PWA, works offline, keeps the screen awake where supported.
- Feb 29 birthdays fall back to Feb 28 in non-leap years.

## Occasions
| Occasion | Repeats | Count shown |
|---|---|---|
| Birthday | yearly | age they are turning |
| Anniversary | yearly | Nth anniversary |
| Wedding day | once | — |
| New Year | yearly, fixed Jan 1 (no date field) | the new year |
| Festival (Diwali, Eid, Christmas, Pongal…) | once | — |
| Baby arrival (due date) | once | — |
| Graduation | once | — |
| Retirement | once | — |
| Custom event | once | — |

Each is one entry in `OCCASIONS` in `app.js` (field reference in the comment above it). One-time occasions reject past dates and show "Already celebrated" once the day has passed. Links carry the occasion as `o=`; birthday links omit it, so older links keep working. Bump `VERSION` in `sw.js` on every release.

## Stack
Static HTML/CSS/JS, no build step. Hosted on GitHub Pages.

## Deploy
Push to `main`; GitHub Pages serves the repo root. Bump `VERSION` in `sw.js` on every release so installed copies update.

### Custom domain
1. Add a `CNAME` file containing your domain (e.g. `countdown.example.com`).
2. DNS: `CNAME countdown → karthick-mallow.github.io` (or apex A records 185.199.108-111.153).
3. Repo → Settings → Pages → enable **Enforce HTTPS**.
4. Update the `og:url` / `og:image` URLs in `index.html` and `404.html`.
