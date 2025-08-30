# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js routes and API handlers (e.g., `/api/health`, `/api/cache-status`).
- `components/`: UI components (PascalCase, client components by default).
- `lib/`: Core logic (API clients, caching, SDK integrations).
- `analytics/`: SQLite DB (`analytics/database/analytics.db`) and data scripts.
- `scripts/`: Developer utilities and verification scripts (e.g., `test-api-endpoints.js`).
- `docs/`, `README.md`, `endpoints.md`, `Math.md`, `CLAUDE.md`: Documentation.

## Build, Test, and Development Commands
- Install: `npm install`
- Dev server: `npm run dev` (open the printed localhost URL)
- Production build: `npm run build` then `npm start`
- API smoke tests: `node scripts/test-api-endpoints.js`
- Orca/CETUS checks: `node scripts/test-orca-positions.js`, `node scripts/final-cetus-verification.js`
- Analytics API check: `curl http://localhost:3000/api/pool-analytics?limit=10`

## Coding Style & Naming Conventions
- Language: TypeScript (React functional components, hooks).
- Files: Components `PascalCase.tsx`; utilities/modules `kebab-case.ts`.
- Indentation: 2 spaces; keep line lengths reasonable; prefer clear, explicit types.
- Data policy: No mock data in UI—use real APIs with fallbacks and caching (`lib/data-cache.ts`).

## Testing Guidelines
- Framework: None configured; rely on endpoint scripts and manual verification.
- Add lightweight checks under `scripts/` (pattern: `test-*.js`) for new integrations.
- Validate endpoints: `/api/health`, `/api/cache-status`, `/api/zerion-portfolio`.
- Keep tests deterministic; avoid external rate limits by using cache where possible.

## Commit & Pull Request Guidelines
- Commit style: Imperative and scoped (examples from history: "Fix ...", "Add ...", "Update ...", "Refactor ...").
- PR requirements:
  - Purpose and summary of changes.
  - Link related issues or docs sections (e.g., `endpoints.md`, `Math.md`).
  - Include screenshots or JSON snippets for UI/API changes.
  - Note data sources used and any fallbacks activated.

## Security & Configuration Tips
- Store secrets in `.env` (keys: `DEFILLAMA_API_KEY`, `ZERION_API_KEY`, `HELIUS_API_KEY`, etc.).
- Never commit `.env`, private wallets, or logs with sensitive data (`.gitignore` already configured).
- SQLite path: `analytics/database/analytics.db` (read-only in app; migrations via scripts).
- Follow endpoint specs in `endpoints.md`; confirm live connectivity before merging.
