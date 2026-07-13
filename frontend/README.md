# LeafMind — Frontend

The frontend foundation for **LeafMind v3.0**, a research-grade AI web
application for medicinal plant identification and reasoning. This
sprint delivers the application shell only — routing, layout, theming,
and reusable UI primitives. AI features, authentication logic, and RAG
integration land in later sprints.

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
- **Protected routes**: `src/routes/ProtectedRoute.tsx` gates routes on
  client-side auth state only. It does not verify tokens or call the
  backend — that logic is added once the FastAPI auth API exists.
- **API layer**: `src/lib/api-client.ts` configures a shared Axios
  instance. `src/services/*.service.ts` files define typed request
  functions per resource; none are wired to real UI flows yet.
- **UI components**: `src/components/ui` is managed by the shadcn CLI
  (`npx shadcn@latest add <component>`). Prefer adding new primitives
  through the CLI rather than hand-writing them.

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components are added to `src/components/ui` using the aliases defined
in `components.json`.
