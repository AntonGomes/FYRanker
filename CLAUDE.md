# FY Ranker

Next.js + TypeScript + shadcn/ui app. Source lives in `web/`.

## UI Guidelines

- **Never use low contrast text/backgrounds.** Text must always be clearly readable against its background. Avoid `text-muted-foreground/40`, `text-muted-foreground/60`, or similar near-invisible opacity values.
- **Avoid monotonousness.** Use visual hierarchy, distinct weights, and colour to differentiate elements.
- **Prefer clear labels** over mystery values — always label scores, counts, etc.

## Development Workflow

- **Always use Playwright** when working on frontend UI development — take screenshots to verify changes visually before considering them done.
- **Commit and push regularly** — don't let work pile up. Commit after each meaningful change and push to remote frequently.
- **Fetch and pull regularly** when working in a git worktree — stay in sync with the main repo to avoid drift and merge conflicts.

## Turbopack Cache

When adding **new CSS class names** to `globals.css`, Turbopack's `.next/` cache may serve stale compiled CSS. If Playwright screenshots show old styles after a CSS edit:

```bash
rm -rf web/.next   # dev server (always running on :3000) auto-recompiles
```

This is only needed for *new* class names — editing values in existing rules hot-reloads fine.

## Playwright Screenshots

Always use the **`npx playwright screenshot`** CLI — never try to import `playwright` as a Node/Python module.

```bash
# Basic screenshot
npx playwright screenshot --viewport-size="375,812" http://localhost:3000/results /tmp/screenshot.png

# With test data: create a storage-state JSON file, then use --load-storage
npx playwright screenshot --load-storage /tmp/storage-state.json --viewport-size="375,812" --wait-for-timeout 2000 http://localhost:3000/results /tmp/screenshot.png

# Useful flags
#   --viewport-size "WIDTHxHEIGHT"   set viewport
#   --wait-for-timeout <ms>           wait before capture
#   --wait-for-selector <sel>         wait for element
#   --load-storage <file>             inject localStorage/cookies from JSON
#   --full-page                       capture entire scrollable page
```

Storage state JSON format for `--load-storage`:
```json
{
  "cookies": [],
  "origins": [{
    "origin": "http://localhost:3000",
    "localStorage": [
      { "name": "fy_scored_jobs", "value": "[...]" }
    ]
  }]
}
```

## shadcn CLI

```bash
# Add components
npx shadcn@latest add [component]    # e.g. button, card, dialog
npx shadcn@latest add -a             # add all components

# Common flags
#   -y             skip confirmation
#   -o             overwrite existing
#   -c <cwd>       set working directory
#   --no-src-dir   no src/ directory

# Search/list available components
npx shadcn@latest search @shadcn -q "button"
npx shadcn@latest list @shadcn

# View component source before installing
npx shadcn@latest view button card
```
