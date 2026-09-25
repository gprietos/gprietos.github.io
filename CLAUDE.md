# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Jekyll static blog for `gprietos.github.io`, built on the [Chirpy Starter](https://github.com/cotes2020/chirpy-starter), which pulls in the `jekyll-theme-chirpy` gem for layouts/includes/sass and keeps only the files that must live in the site repo itself (theme files the gem can't ship: `_config.yml`, `_plugins`, `_tabs`, `index.html`).

## Commands

Requires Ruby + Bundler. Install dependencies with `bundle install` (there is no `Gemfile.lock` committed).

- **Serve locally with live reload**: `bash tools/run.sh` (wraps `bundle exec jekyll s -l`)
  - `-H, --host <HOST>` to bind to a specific host
  - `-p, --production` to run with `JEKYLL_ENV=production`
- **Build + test (what CI runs)**: `bash tools/test.sh` — builds the site into `_site` with `JEKYLL_ENV=production`, then runs `htmlproofer` against it (`--disable-external`, ignoring localhost URLs)
  - `-c, --config "<file_a[,file_b]>"` to build with alternate/additional config files (baseurl is read from the last config in the list that defines one)
- **Build only**: `bundle exec jekyll b`
- There are no unit tests; correctness is validated by the Jekyll build succeeding and `htmlproofer` finding no broken internal links/HTML issues.

## Deployment

`.github/workflows/pages-deploy.yml` builds and deploys to GitHub Pages via GitHub Actions on every push to `main`/`master` (ignoring changes to `.gitignore`, `README.md`, `LICENSE`), or via manual `workflow_dispatch`. It runs the same build + `htmlproofer` check as `tools/test.sh` before deploying. Pages must be configured to deploy from **GitHub Actions** (Settings → Pages → Source) for this to work.

## Site configuration

Almost everything is driven by `_config.yml` (title, tagline, `url`, social links, comments provider, analytics, PWA, etc.) — see the inline comments in that file for each option's meaning. Author/contact info also lives in `_data/contact.yml` (which contact icons/links appear in the footer).

## Content structure

- `_posts/` — blog posts (currently empty; add posts here). Posts get `layout: post`, `comments: true`, `toc: true`, and permalink `/posts/:title/` by default (set in `_config.yml`'s `defaults`).
- `_tabs/` — top-level nav pages (`about.md`, `archives.md`, `categories.md`, `tags.md`); these get `layout: page` and permalink `/:title/`.
- `_plugins/posts-lastmod-hook.rb` — sets a post's last-modified time from its git history.
- `assets/lib` — a git submodule (`.gitmodules` → `chirpy-static-assets`) for self-hosting theme static assets instead of the jsDelivr CDN; currently empty/uninitialized, and the deploy workflow's submodule checkout is commented out. Only needed if `assets.self_host.enabled` is turned on in `_config.yml`.

## Notes

- This repo intentionally excludes `tools/`, `README.md`, `LICENSE`, and gem/package files from the built site (see `exclude:` in `_config.yml`).
- `.devcontainer/` provides a Jekyll devcontainer (VS Code) with Liquid/shell tooling preinstalled — not required for local development outside VS Code.
- PWA offline cache is intentionally disabled (`pwa.cache.enabled: false` in `_config.yml`; `pwa.enabled` stays `true`, so the site is still installable). With it on, the theme's service worker kept serving stale CSS/pages after changes until a hard reload (Ctrl+Shift+R). With it off, the service worker purges any existing cache on the next visit. Set it back to `true` to re-enable offline caching.
- RSS: `jekyll-feed` still generates `/feed.xml` on every build (it's a default Chirpy gem dependency), but the RSS icon/link in the sidebar footer is disabled — the `rss` entry in `_data/contact.yml` is commented out. Uncomment it to re-add the sidebar link; no other changes are needed since the feed itself is always generated.
