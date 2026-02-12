# FY Ranker

Next.js + TypeScript + shadcn/ui app. Source lives in `web/`.

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
