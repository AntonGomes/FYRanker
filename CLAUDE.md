# FY Ranker

Next.js + TypeScript + shadcn/ui app. Source lives in `web/`.

## UI Guidelines

- **Never use low contrast text/backgrounds.** Text must always be clearly readable against its background. Avoid `text-muted-foreground/40`, `text-muted-foreground/60`, or similar near-invisible opacity values.
- **Avoid monotonousness.** Use visual hierarchy, distinct weights, and colour to differentiate elements.
- **Prefer clear labels** over mystery values — always label scores, counts, etc.

## Development Workflow

- **Always use Playwright** when working on frontend UI development — take screenshots to verify changes visually before considering them done.

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
