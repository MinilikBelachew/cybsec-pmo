<div align="center">
  <h1>Enterprise Next.js Boilerplate</h1>
  <p>A scalable enterprise-grade Next.js boilerplate built with clean architecture, feature-driven organization, RTK Query, TypeScript, and modern frontend standards.</p>
</div>

Designed for:
- SaaS platforms
- Enterprise dashboards
- Large frontend teams
- Long-term scalable products

---

<h2>1. Core Philosophy</h2>

This boilerplate follows:

- <b>Feature-first architecture</b>: Grouping code by business domain rather than technical type.
- <b>Domain-driven organization</b>: Keeping features isolated, independent, and easily deletable or extractable.
- <b>Clean architecture principles</b>: Strict boundaries between UI, business logic, and API layers.
- <b>Separation of concerns</b>: UI components only render; hooks manage state; services orchestrate logic; API handles network.
- <b>Reusable business logic</b>: Logic can be reused across different UI components without duplication.
- <b>Predictable scalable patterns</b>: Strict naming and structural rules so the codebase remains maintainable as the team grows.

<h2>2. Tech Stack</h2>

| Category | Technology |
| :--- | :--- |
| <b>Framework</b> | Next.js 16 (App Router) |
| <b>Language</b> | TypeScript |
| <b>State</b> | Redux Toolkit |
| <b>API</b> | RTK Query |
| <b>Validation</b> | Zod |
| <b>Forms</b> | React Hook Form |
| <b>Styling</b> | Tailwind CSS v4 |
| <b>Components</b> | shadcn/ui & Base UI |
| <b>Tables</b> | TanStack Table v8 |
| <b>i18n</b> | next-intl |

<h2>3. Project Structure</h2>

```text
src/
├── app/
│   ├── [locale]/       - Next.js App Router pages and layouts (localized)
│   └── api/            - Mock API Route Handlers (dev only — no real backend)
│       ├── auth/       - login, logout, me, refresh mock endpoints
│       └── health/     - Health check endpoint
├── config/             - Global environment variables and app configurations
├── core/               - Core system services (Logger, Base API, Permissions, Feature Flags)
├── domains/            - Domain-driven feature modules (e.g., auth, users, projects)
├── i18n/               - Internationalization setup and dictionaries
├── lib/                - Utility functions and shared helpers
├── providers/          - Global React Context providers
├── shared/             - Cross-domain shared UI components and hooks
├── store/              - Global Redux store configuration and cross-cutting slices
└── proxy.ts            - Next.js middleware for auth, routing, and i18n orchestration
```

<b>Folder Responsibilities:</b>
- <b>app/[locale]/</b>: Strictly routing. Contains page/layout definitions. Imports components from domains or shared.
- <b>app/api/</b>: In-process mock API handlers for development. These are <b>not a real backend</b> — they simulate API responses using static mock data so the frontend can be developed in isolation. Replace these with calls to your real API in production.
- <b>core/</b>: The foundation. Handles error tracking, interceptors, and application-wide services.
- <b>domains/</b>: The heart of the app. Every business feature lives here. Domains must be isolated and rarely cross-depend.
- <b>shared/</b>: UI components (buttons, inputs, layouts) used everywhere. Must have <b>zero</b> business logic or domain dependencies.

<h2>4. Clean Architecture Rules</h2>

- <b>Components must not contain business logic</b>: Components are strictly for rendering UI and calling hooks.
- <b>Services contain workflows and business rules</b>: Complex state operations or multi-step logic belong in .service.ts files.
- <b>API layers only handle communication</b>: API files (via RTK Query) only define endpoints, methods, and tags.
- <b>Transformers isolate backend models</b>: Always transform backend DTOs (Data Transfer Objects) into frontend domain models before they reach the UI.
- <b>Shared layer cannot depend on domains</b>: src/shared can only depend on src/core or src/lib.
- <b>Domains should remain isolated</b>: A domain should not deeply import another domain's internals.

<h2>5. Data Flow Documentation</h2>

This is the standard flow of data for a feature implementation:

```text
Component (Renders UI, binds to Hook)
   ↓
Hook (Manages local state, calls Service/RTK Query)
   ↓
Service (Optional: Orchestrates complex business logic)
   ↓
API (RTK Query endpoint execution)
   ↓
Transformer (Maps Backend DTO -> Frontend Model)
   ↓
Store (RTK Query Cache / Redux State updated)
```

<h2>6. Feature Development Guide</h2>

When creating a new feature (e.g., projects), follow these steps:

1. <b>Create domain folder</b>: src/domains/projects
2. <b>Add Types & Schemas</b>: Define Zod schemas and TypeScript interfaces in types/ and schemas/.
3. <b>Add API layer</b>: Create endpoints using api.injectEndpoints() in api/projects.api.ts.
4. <b>Add Transformers</b>: Create mapping functions in transformers/ if backend models differ from frontend needs.
5. <b>Add Store/Services</b>: Add a slice in store/ or complex logic in services/ if needed.
6. <b>Add Hooks</b>: Create custom hooks in hooks/ to bridge components to the API/Store.
7. <b>Add UI components</b>: Build domain-specific UI in components/.
8. <b>Register permissions</b>: Add required roles/permissions to core/permissions/.

<h2>7. Naming Conventions</h2>

To ensure consistency across large teams, strict naming rules apply:

- <b>Component naming</b>: PascalCase (ProjectCard.tsx, UserForm.tsx)
- <b>Hook naming</b>: camelCase, prefixed with use (useProjects.ts, useAuth.ts)
- <b>File naming (non-components)</b>: kebab-case with type suffix (auth.service.ts, user.api.ts, project.schema.ts, auth.slice.ts)
- <b>API endpoints</b>: camelCase (getProjects, createUser)

<h2>8. API Architecture Documentation</h2>

This boilerplate is <b>purely frontend</b>. It includes an <b>Env-Toggled Mock Interceptor</b> built directly into the base API (src/core/api/base-api.ts). This allows you to develop the entire frontend without a backend, while ensuring your domain code is 100% ready for the real API.

```text
Component
   ↓
Domain Hook (e.g., useLoginMutation)
   ↓
Domain API — injects endpoints into base api (auth.api.ts)
   ↓
Base API Interceptor (src/core/api/base-api.ts)
   ├── If NEXT_PUBLIC_USE_MOCK_API=true → Returns Mock JSON & Sets Cookie
   └── If NEXT_PUBLIC_USE_MOCK_API=false → Passes request to Real Backend URL
```

- <b>Single Base API</b>: All domain APIs call api.injectEndpoints() into one shared RTK Query instance (src/core/api/api.ts).
- <b>Interceptors</b>: base-api.ts attaches user metadata headers on every request.
- <b>Mock Interceptor</b>: Intercepts requests like /auth/login and simulates the network, allowing the frontend to act exactly as it would in production without any server-side code.
- <b>401 Handling</b>: The base query detects 401 Unauthorized, clears the auth store, and lets the middleware redirect to /login.

<h2>9. Auth Architecture Documentation</h2>

<blockquote>
  <b>This boilerplate is frontend-only.</b> Authentication is fully mocked using static user data intercepted at the RTK Query layer — there is no real backend.
</blockquote>

<b>Mock Users (defined in src/core/api/base-api.ts):</b>

| Email | Password | Role |
| :--- | :--- | :--- |
| admin@example.com | admin123 | admin |
| user@example.com | user123 | member |

<b>Login Flow:</b>
```text
1. User submits login form
   ↓
2. useLogin() hook calls loginService() with credentials
   ↓
3. RTK Query attempts a POST to /auth/login
   ↓
4. base-api.ts intercepts the request, simulates latency, and checks MOCK_USERS
   ↓
5. On success: sets document.cookie = access_token
   ↓
6. Response user object is transformed via apiUserToUser() transformer
   ↓
7. dispatch(setUser(user)) — Redux auth store updated
   ↓
8. proxy.ts (middleware) detects the cookie on the next request and allows access
```

<b>Protected Routes:</b>
Next.js proxy.ts (middleware) runs at the edge on every request. It checks for the access_token cookie. If absent on a protected route, it redirects the user to /login with a callbackUrl parameter.

<b>Connecting a Real Backend:</b>
To connect your real backend and disable the mocks, simply update your .env file:
```env
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_URL=https://your-real-backend.com/api
```
Your domain code (auth.api.ts, auth.service.ts) does <b>not</b> need to change.

<h2>10. Permission System Documentation</h2>

Role-Based Access Control (RBAC) and feature gating are built-in.

- <b>Permissions Definition</b>: Roles and granular permissions are defined in src/core/permissions/roles.ts.
- <b>Guards</b>: The can.ts utility evaluates if the current user's role has specific permissions.
- <b>Feature Access</b>: Use the &lt;PermissionGate&gt; component to conditionally render UI based on user rights.

Example usage:
```tsx
import { PermissionGate } from "@/shared/components/permission-gate";

<PermissionGate permission="users.edit">
  <Button>Edit User</Button>
</PermissionGate>
```

<h2>11. Table System Documentation</h2>

Enterprise applications require heavy data grids. We use @tanstack/react-table encapsulated in a reusable DataTable component (src/shared/components/data-table.tsx).

- <b>Server-Side Mode</b>: Built to handle server-side pagination, sorting, and filtering efficiently.
- <b>URL Sync</b>: Table state (page, filters) should ideally sync with URL search params for shareable links.
- <b>Customizable</b>: Supports custom cell rendering, row selection, and expandable rows while keeping the core logic isolated.

---

<h2>Scripts</h2>

- npm run dev: Starts the Next.js development server.
- npm run build: Builds the application for production.
- npm run start: Starts the production server.
- npm run lint: Runs ESLint to catch and fix code issues.

<h2>License</h2>

This project is licensed under the MIT License.
