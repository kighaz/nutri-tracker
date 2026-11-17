# Nutri-Tracker Project Rules

## Tech Stack
- Next.js (App Router), TypeScript (strict), Tailwind CSS, Lucide React
- Database & Auth: Supabase (`@supabase/supabase-js`, `@supabase/ssr`) using `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`sb_publishable_...`)
- AI SDK: `@google/genai` (Gemini Flash Vision) via Server Actions
- External APIs: OpenFoodFacts (FR/Global) + USDA FoodData Central

## Architecture & File Map
- `types/nutrition.ts`: Canonical 6 macros + 13 micronutrients schema (normalized to `mg` and `mcg`)
- `lib/i18n.ts`: Trilingual FR/EN/DE dictionary (default `fr`); all UI strings go through `t()`, including the `guide.*` keys
- `components/AppShell.tsx`: Header, tab nav, auth state; opens the guide on first visit (`localStorage` key `nutri_tracker_guide_seen`) and via the header `HelpCircle` button
- `lib/guard.ts`: Server-only auth + per-user rate-limit gate (`consume_rate_limit` RPC, fails closed); every Gemini/USDA/OFF action must call it
- `app/actions/account.ts`: `exportMyData` (RGPD Art. 15/20) and `deleteMyAccount` (Art. 17, calls SQL `delete_my_account()`)
- `components/LegalModal.tsx` / `AccountPanel.tsx`: trilingual privacy, legal notice, terms, nutrition disclaimer; export/delete controls (in Settings)
- `supabase/security_and_rgpd_patch.sql`: rate limits, delete function, anon revokes. Run it BEFORE deploying code that uses `guard()`
- `components/AppGuideModal.tsx`: Onboarding / user guide modal (what the app is, privacy, logging meals, recipes & targets, PWA install tip)
- `lib/supabase.ts`: Supabase client & server helpers
- `lib/nutrition-resolver.ts`: Hybrid lookup (1. Custom Recipes -> 2. OpenFoodFacts/USDA -> 3. Gemini fallback)
- `app/actions/analyze-food.ts`: Server action for in-memory base64 photo analysis (zero image storage)

## Output & Token Constraints
- Output complete, working code blocks only—never use `// TODO` or `// ... rest of code` placeholders.
- Zero conversational fluff, greetings, or post-code summaries unless explicitly asked.
- When fixing a bug, output only the modified function or exact diff with line context instead of rewriting untouched files.