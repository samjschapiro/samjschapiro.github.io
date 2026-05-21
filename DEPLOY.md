# Deployment notes

This repo hosts **two** sites at the same GitHub Pages output:

| URL                                | Source                                                  |
|------------------------------------|---------------------------------------------------------|
| `schapiro.ai/`                     | Hand-written HTML in `docs/`                            |
| `schapiro.ai/creative-ai-index/`   | Static Next.js export, committed to `docs/creative-ai-index/` |

Both live under `docs/` because GitHub Pages is configured to publish from `main` → `/docs`.

## Editing the personal site

The personal site is plain HTML now (no build step, no Quarto). To update it:

1. Edit `docs/index.html` (or `docs/bookshelf.html`, etc.) directly.
2. Style changes go in `docs/styles.css`.
3. Add new PDFs / images under `docs/files/`.
4. `git add docs/<files-you-touched>`, commit, push.

That's the whole workflow. No render step, no resources directive, no wipe trap.

## Updating the Creative AI Index export

The Creative AI Index lives in [its own repo](https://github.com/samjschapiro/creative-ai-index). The deploy script there builds a static Next.js export and copies it into this repo at `docs/creative-ai-index/`:

```bash
cd ~/Desktop/creative-ai-index
npm run deploy:schapiro
# then in ~/Desktop/samjschapiro2:
git add docs/creative-ai-index
git commit -m "Refresh creative-ai-index export"
git push origin main
```

The script writes both into the staging area (gitignored `creative-ai-index/` at this repo's root) and into `docs/creative-ai-index/`. Only `docs/creative-ai-index/` is committed.

## What's in `docs/`

| Path                          | Purpose                                       |
|-------------------------------|-----------------------------------------------|
| `index.html`                  | Landing page                                  |
| `bookshelf.html`              | Bookshelf page (Quarto-rendered, frozen)      |
| `site_libs/`                  | Bootstrap / Quarto JS for the bookshelf page  |
| `styles.css`                  | Site-wide stylesheet                          |
| `files/`                      | PDFs, images, profile photos                  |
| `creative-ai-index/`          | Creative AI Index static export               |
| `.nojekyll`                   | Disables Jekyll on GitHub Pages               |
| `CNAME`                       | `schapiro.ai`                                 |

## Bookshelf updates

`docs/bookshelf.html` is a frozen render from when the site still used Quarto. To add or remove books, edit `docs/bookshelf.html` directly. If you want to switch the bookshelf to a plain-HTML workflow as well, ask Claude to convert it.

## Cardinal rule

`git add -A` will sweep up the build-time staging copies of the Creative AI Index export at the repo root. Use **explicit-path `git add`** when committing — e.g. `git add docs/<paths> styles.css ...` — to keep commits focused.
