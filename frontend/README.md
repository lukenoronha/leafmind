# LeafMind — Frontend

The frontend foundation for **LeafMind v3.0**, a research-grade AI web
application for medicinal plant identification and reasoning.

- **Sprint 1** delivered the application shell — routing, layout,
  theming, and reusable UI primitives.
- **Sprint 2** delivered a complete authentication system — login,
  signup, password reset, session handling, JWT persistence, and
  role-based access control — wired against placeholder FastAPI
  endpoints.
- **Sprint 3** delivered the User Portal — a Gemini-inspired workflow
  for uploading a plant photo, viewing its identification and health
  report, and asking follow-up questions in a chat interface, plus
  History and Saved Reports views. Chat consumed the placeholder
  `/predict` response as-is; retrieval-augmented generation was not
  implemented yet.
- **Sprint 4** upgraded the chatbot into a RAG interface: streaming
  responses, a three-stage retrieval status indicator, a collapsible
  Sources panel with per-document confidence, response confidence,
  backend-suggested follow-up questions, and conversation persistence.
  Retrieval logic itself lives entirely server-side — the frontend only
  consumes the new RAG endpoints and renders what they return.

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui (Radix primitives)
- React Router v7
- TanStack React Query
- Axios
- React Hook Form + Zod
- Lucide React

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm install
cp .env.example .env.development
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment Variables

| Variable            | Description                     | Default                        |
| ------------------- | ------------------------------- | ------------------------------ |
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend | `http://localhost:8000/api/v1` |
| `VITE_APP_NAME`     | App name shown in the UI        | `LeafMind`                     |
| `VITE_APP_ENV`      | Environment label               | `development`                  |

Copy `.env.example` to `.env.development` (or `.env.local`) and adjust
as needed. Env files other than `.env.example` are gitignored.

## Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the Vite dev server                |
| `npm run build`        | Type-check and build for production      |
| `npm run preview`      | Preview the production build locally     |
| `npm run typecheck`    | Run TypeScript in no-emit mode           |
| `npm run lint`         | Run ESLint                               |
| `npm run lint:fix`     | Run ESLint with autofix                  |
| `npm run format`       | Format the codebase with Prettier        |
| `npm run format:check` | Check formatting without writing changes |

## Project Structure

```text
src/
  assets/        Static assets (images, logo)
  components/
    ui/          shadcn/ui primitives (generated, treat as vendored)
    common/      Reusable app components (Loader, Modal, EmptyState, ...)
    layout/      App shell components (Sidebar, Navbar, Footer, AppLayout)
  config/        Environment config and navigation metadata
  hooks/         Shared React hooks
  lib/           Framework-agnostic utilities (cn, axios client)
  pages/         Route-level page components, grouped by area
  providers/     App-wide context providers (Theme, Query, Auth)
  routes/        Router setup, route paths, and route guards
  services/      Axios-based API service modules (placeholders)
  types/         Shared TypeScript types
```

## Architecture Notes

- **Path alias**: `@/*` resolves to `src/*` (configured in `tsconfig`
  and `vite.config.ts`).
- **Theming**: Light/dark theme is handled by `next-themes` via
  `ThemeProvider`. Colors are defined as CSS custom properties in
  `src/index.css`, derived from the LeafMind logo palette (forest
  green, sage green, warm beige, white, dark slate).
- **Routing**: Defined in `src/routes/router.tsx`. Route path strings
  live in `src/routes/paths.ts` as a single source of truth.
- **Authentication**: `src/providers/AuthProvider.tsx` owns auth state.
  It rehydrates the session from a stored JWT on load (calling
  `/auth/me`), and exposes `login`, `signup`, and `logout` as React
  Query mutations via `useAuth()`. Access/refresh tokens persist in
  `localStorage` through `src/lib/token-storage.ts`, which is why
  login survives a page refresh.
- **Route guards**: `src/routes/ProtectedRoute.tsx` gates nested routes
  on authentication, redirecting to `/login` and preserving the
  attempted location so the user returns there after signing in.
  `src/routes/RoleGuard.tsx` nests inside it to further restrict routes
  by role (`user` / `developer` / `admin`), redirecting to
  `/unauthorized` otherwise. Sidebar navigation
  (`src/config/navigation.ts`) is filtered by the same roles so links
  a user can't access aren't shown.
- **Axios interceptors**: `src/lib/api-client.ts` attaches the access
  token to every request. On a 401, it attempts a single silent
  refresh via `/auth/refresh` and retries the original request; if the
  refresh fails, tokens are cleared and the app redirects to
  `/session-expired`. `src/lib/auth-events.ts` bridges that redirect
  from the interceptor (outside React) back into `AuthProvider`.
- **API layer**: `src/services/*.service.ts` files define typed
  request functions per resource against the FastAPI routes from
  Sprint 1's contract. The backend itself doesn't exist yet, so these
  calls will fail until it's implemented — this is expected.
- **UI components**: `src/components/ui` is managed by the shadcn CLI
  (`npx shadcn@latest add <component>`). Prefer adding new primitives
  through the CLI rather than hand-writing them.
- **Analysis workflow**: `src/pages/HomePage.tsx` ("New Analysis")
  orchestrates upload → predict → results. `src/hooks/use-image-upload.ts`
  and `src/hooks/use-predict.ts` wrap the `/upload` and `/predict`
  mutations (with upload progress). `src/components/analysis/` holds
  the feature's components (`ImageUploader`, `PredictionCard`,
  `HealthReportCard`, `AnalysisSessionList`, `ConfidenceBadge`, and the
  `chat/` subfolder). History and Saved Reports (`src/pages/history`,
  `src/pages/saved-reports`) both read from `/history` via
  `src/hooks/use-analysis-history.ts` and render through the same
  `AnalysisSessionList`.
- **RAG chat**: `src/hooks/use-analysis-chat.ts` drives the chat panel.
  It streams `/predict/chat/stream` via `src/lib/stream-client.ts`,
  which parses newline-delimited JSON (NDJSON) events over the
  fetch Streams API — Axios's browser adapters don't expose a response
  body incrementally, so this one endpoint bypasses `api-client.ts` and
  talks to `env.apiBaseUrl` directly, attaching the same bearer token.
  Every other request still goes through the shared Axios client.
  Expected event shape (see `ChatStreamEvent` in `stream-client.ts`):
  `{ type: 'status', stage }` → `{ type: 'sources', sources }` →
  repeated `{ type: 'token', content }` → `{ type: 'done', ... }` (or
  `{ type: 'error', message }`). The hook does no retrieval itself; it
  only renders the stages, sources, and tokens the backend emits.
  Conversations persist to `localStorage` per prediction ID via
  `src/lib/chat-storage.ts`, so returning to the same analysis restores
  the conversation. Backend-suggested follow-up questions come from
  `src/hooks/use-follow-up-questions.ts` (`GET
/predict/{predictionId}/follow-ups`), falling back to a generic
  prompt set until the backend responds.
- **Retrieval status & sources**:
  `src/components/analysis/chat/RetrievalStatusIndicator.tsx` renders
  the Searching → Retrieved → Generating pipeline from the `status`
  events. `src/components/analysis/chat/SourcesPanel.tsx` is a
  collapsible list of retrieved documents (title, chapter, page number,
  retrieval confidence) attached to each assistant message via the
  `sources` event. `ConfidenceBadge` is shared across prediction match
  confidence, per-source retrieval confidence, and final response
  confidence for a consistent visual language.

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components are added to `src/components/ui` using the aliases defined
in `components.json`.
