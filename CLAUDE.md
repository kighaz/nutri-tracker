# Nutri-Tracker Project Rules

## Tech Stack
- Next.js (App Router), TypeScript (strict), Tailwind CSS, Lucide React
- Database & Auth: Supabase (`@supabase/supabase-js`, `@supabase/ssr`) using `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`sb_publishable_...`)
- AI SDK: `@google/genai` (Gemini Flash Vision) via Server Actions
- External APIs: OpenFoodFacts (FR/Global) + USDA FoodData Central

## Architecture & File Map
- `types/nutrition.ts`: Canonical 6 macros + 13 micronutrients schema (normalized to `mg` and `mcg`)
- `lib/i18n.ts`: Bilingual FR/EN dictionary
- `lib/supabase.ts`: Supabase client & server helpers
- `lib/nutrition-resolver.ts`: Hybrid lookup (1. Custom Recipes -> 2. OpenFoodFacts/USDA -> 3. Gemini fallback)
- `app/actions/analyze-food.ts`: Server action for in-memory base64 photo analysis (zero image storage)

## Output & Token Constraints
- Output complete, working code blocks only—never use `// TODO` or `// ... rest of code` placeholders.
- Zero conversational fluff, greetings, or post-code summaries unless explicitly asked.
- When fixing a bug, output only the modified function or exact diff with line context instead of rewriting untouched files.