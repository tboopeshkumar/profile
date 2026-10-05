# profile

Boopesh Kumar's interactive profile and CV, hosted free on GitHub Pages at **https://tboopeshkumar.github.io/profile/**.

It's plain HTML, CSS and JavaScript with no build step and no dependencies. All content lives in [`data/profile.json`](data/profile.json).

## Features

- **Career timeline:** a chart of every role since 2010. Hover a bar for details; click it to jump to that role.
- **Technology highlight:** click a skill (or a role's tag on desktop) to highlight the roles that used it. Highlighted views are shareable links, e.g. `?tech=React`.
- **Skills:** grouped skill chips; clicking one filters the experience list.
- **Recruiter shortcuts:** Email, Copy email, LinkedIn, GitHub, and Save contact (downloads a `.vcf` card).
- **Download CV:** serves the PDF set in `basics.cv` (`assets/Boopesh-Kumar-CV.pdf`). Without one, the button falls back to a print-friendly layout. Ctrl+P also prints that layout.
- **Display:** light/dark mode and four accent colours (navy, teal, plum, graphite). Both choices are remembered.
- **Responsive and accessible:** works on phones, can be used with the keyboard alone, and respects reduced-motion settings.

## Editing content

Edit `data/profile.json`, then commit and push. Pages redeploys in about a minute.

- `experience[].tags` drive the technology highlight. Use the same spelling as in `skills` so skill chips link up.
- `experience[].earlier: true` moves a role into the compact "Earlier career" list.
- `domain: "finance"` counts a role toward the "years in financial services" stat.
- After changing `assets/app.js` or `assets/style.css`, bump the `?v=` value on both links in `index.html`. GitHub Pages lets browsers cache files for ~10 minutes, and this stops a new page from running an old cached script.
- To update the CV, replace `assets/Boopesh-Kumar-CV.pdf` and bump the `?v=` on `basics.cv` and on the nav link in `index.html`.
- Profile photo: put a square image in `assets/` (e.g. `assets/profile.jpg`, ~400×400) and set `basics.photo` to that path. With no photo the hero simply omits it.
- `basics.phone` is empty by default so the number isn't published to scrapers. Fill it in to show it on the CV and in the contact card.

## Importing from LinkedIn (optional)

```bash
python3 tools/linkedin_to_json.py ~/Downloads/Basic_LinkedInDataExport_*.zip
```

This merges LinkedIn positions, education, certifications and languages into `profile.json`. It keeps hand-written fields such as tags and short names. New skills go into an "Other" group. Don't commit the export zip; `.gitignore` excludes it.

## Preview locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Enable GitHub Pages (one time)

Go to **Settings → Pages**, set Source to *Deploy from a branch*, and pick `main` / `/ (root)`.
