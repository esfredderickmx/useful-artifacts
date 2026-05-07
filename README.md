# Useful Artifacts Registry

A small shadcn/ui registry for reusable React components, with Laravel and Inertia projects as the main target.

The local site is a Vite React app written in TypeScript. Vite serves the app from `src` and the generated registry payloads from `public/r`.

## Build

```bash
pnpm registry:build
```

The build outputs registry JSON files to `public/r`.

For the full app build:

```bash
pnpm build
```

## Test Locally

Start the Vite dev server:

```bash
pnpm dev
```

After adding a registry item, install it into a shadcn-enabled app:

```bash
pnpm dlx shadcn@latest add http://localhost:5173/r/<item-name>.json
```

If Vite prints a different port because `5173` is already in use, use that printed URL instead.

For a Laravel project, initialize shadcn with the Laravel template first if needed:

```bash
pnpm dlx shadcn@latest init --template laravel
```

You can also register this registry in a Laravel project's `components.json` once it is hosted:

```json
{
  "registries": {
    "@useful": "https://your-domain.test/r/{name}.json"
  }
}
```

Then install items with:

```bash
pnpm dlx shadcn@latest add @useful/laravel-resource-card
```

The example component uses standard `@/components/ui/*` and `@/lib/utils` imports so the shadcn CLI can rewrite them to the target project's aliases.
