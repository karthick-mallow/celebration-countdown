# Midnight Birthday Countdown

A full-screen countdown to 00:00 on someone's birthday, with confetti when it hits zero.

**Live:** https://karthick-mallow.github.io/birthday-countdown/

## Features
- Countdown to midnight in **any time zone** (DST-safe). Viewers elsewhere see their own local time too.
- **Shareable links**: `?n=Aarav&d=2025-10-20&tz=Asia/Kolkata` (`a=0` hides age). No backend, no data stored server-side.
- Full-screen stage mode (button or `F`), cursor auto-hides, `Esc` exits.
- Last 60 seconds: seconds-only, centred. Confetti + "Happy Birthday" at zero, for the whole day.
- 10-second rehearsal mode.
- Installable PWA, works offline, keeps the screen awake where supported.
- Feb 29 birthdays fall back to Feb 28 in non-leap years.

## Occasions
Birthday is the first occasion. Each one is a single entry in the `OCCASIONS` registry in `app.js`:

| Field | Purpose |
|---|---|
| `label` | Name in the Occasion picker |
| `recurs` | `yearly` (repeats on the date) or `once` (that exact date) |
| `nameLabel`, `namePlaceholder`, `dateLabel`, `countLabel` | Setup form text |
| `noun` | Headline: "Aarav's **birthday**" |
| `countPhrase(n)` | e.g. "turning 5", "10th anniversary" |
| `cheer(name)`, `cheerSub(n)` | Text shown at midnight |

The Occasion picker stays hidden until a second entry exists. Links carry the occasion as `o=` (omitted for birthday, so existing links never break). A commented-out anniversary entry shows the shape. Bump `VERSION` in `sw.js` when you ship one.

## Stack
Static HTML/CSS/JS, no build step. Hosted on GitHub Pages.

## Deploy
Push to `main`; GitHub Pages serves the repo root. Bump `VERSION` in `sw.js` on every release so installed copies update.

### Custom domain
1. Add a `CNAME` file containing your domain (e.g. `countdown.example.com`).
2. DNS: `CNAME countdown → karthick-mallow.github.io` (or apex A records 185.199.108-111.153).
3. Repo → Settings → Pages → enable **Enforce HTTPS**.
4. Update the `og:url` / `og:image` URLs in `index.html` and `404.html`.
