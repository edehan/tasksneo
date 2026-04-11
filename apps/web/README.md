# TaskFlow Web

Next.js 16 frontend for the TaskFlow monorepo.

## Local development

Run from the repo root:

```bash
pnpm dev:web
```

Or run only the web app from this directory:

```bash
pnpm dev
```

The app expects `NEXT_PUBLIC_API_BASE_URL` to point at the backend API. In local development that is usually `http://localhost:3001`.

## Notes

- Authentication uses opaque session tokens issued by the API, not JWTs.
- Session expiry / forced sign-out behavior is handled centrally in `src/lib/api.ts` and `src/components/auth-provider.tsx`.
- Product and API references live in the repo root docs:
  - `../../docs/openapi/openapi.yaml`
  - `../../docs/features/auth.md`
  - `../../docs/ux/`
