---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Project Notes

`picture-it` is a CLI tool for composable image operations. Treat it like a command-line product, not a Bun-only app:

- Local development uses Bun.
- The published artifact targets Node.js 18+ via `scripts/build.ts`, which rewrites the shebang in `dist/index.js`.
- Avoid introducing Bun-only runtime APIs into `index.ts` or `src/**` unless the code path is build-time only.

Important CLI contract:

- Commands print only the output path to stdout, or JSON for `batch`.
- Progress and diagnostics go to stderr via `log()` in `src/operations.ts`.
- Preserve subcommand names, flag names, and stdout shape unless the user explicitly asks for a breaking change.

## Provider Work

If you touch AI inference code, read `docs/add-replicate-provider.md` first.

Current provider-related files:

- `src/fal.ts`
- `src/model-router.ts`
- `src/types.ts`
- `src/operations.ts`
- `src/config.ts`
- `src/pipeline.ts`
- `index.ts`

Planned provider layout from the current doc:

- `src/providers/types.ts`
- `src/providers/fal.ts`
- `src/providers/replicate.ts`
- `src/providers/index.ts`

Also update the surrounding shipped/docs surface when provider behavior changes:

- `package.json`
- `bun.lock`
- `scripts/build.ts`
- `README.md`
- `CLAUDE.md`
- `skill/picture-it/SKILL.md`
- `docs/add-replicate-provider.md`
- `docs/replicate-model-mapping.md`

Provider guardrails from the current plan:

- Support both FAL and Replicate. Do not remove FAL.
- Introduce a provider abstraction for inference work instead of branching provider logic throughout the CLI.
- FAL remains the default provider unless the user explicitly changes config, env, or CLI flags.
- Model names stay logical and provider-agnostic. Do not silently substitute unsupported models on another provider.
- Keep static cost hints for routing; any actual-cost logging still goes to stderr.
- Additive auth only: `auth --fal` stays, `auth --replicate` is added.
- Provider selection precedence is: CLI flag, then `PICTURE_IT_PROVIDER`, then saved config, then default `fal`.
- Prefer a global root `--provider <fal|replicate>` flag over duplicating provider flags on each inference subcommand.
- Pipeline and batch specs may gain an optional top-level `provider` field; treat that as part of the reproducibility contract if implemented.

Replicate coverage notes from `docs/replicate-model-mapping.md`:

- Coverage survey is complete; version hashes, input schema diffs, pricing, and a few edge-case verifications are still pending.
- Do not assume every logical model is available on Replicate:
  - `pixelcut` is missing.
  - `imagineart` exists only as a community 1.0 variant and is a likely FAL-only candidate.
  - `birefnet` and `rembg` are community-model candidates on Replicate, not vendor-backed.
  - `fibo-edit` exact slug and nano-banana edit-path behavior still need verification.
- When provider support differs, prefer a clear user-facing error with supported alternatives over aliasing or silent fallback.
- Until the team decides otherwise, prefer official Replicate models where possible and treat community-model support as an explicit choice, not an assumption.
- The cost-table shape is not fully settled in the docs yet; do not assume shared-per-model pricing versus per-provider pricing without checking the latest plan.

## Current Codebase Realities

- The codebase is still FAL-first today. The provider abstraction is not implemented yet.
- `src/pipeline.ts` and several CLI commands still depend on `uploadFile` and `uploadBuffer`.
- Input handling is file-path based today. Do not assume HTTP URL inputs already work:
  - `index.ts` validates `edit` inputs with `fs.existsSync`.
  - `readInput()` in `src/operations.ts` reads from local paths only.
- `scripts/build.ts` still externalizes `@fal-ai/client`; update build metadata and dependencies when adding `replicate`.
- The migration plan assumes `prepareImageInput()` will hide the FAL upload vs Replicate data-URI difference. Keep provider-specific image preparation behind that seam.

## Verification

There is no meaningful automated test suite yet. When changing inference, auth, routing, or pipeline behavior, prefer this minimum verification set:

- `bun run build`
- smoke-test `generate`
- smoke-test `edit`
- smoke-test `remove-bg`
- smoke-test `upscale`
- smoke-test `pipeline`
- smoke-test a non-AI path such as `template` or `text`
