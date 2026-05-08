# Useful Artifacts Registry

A small shadcn/ui registry for reusable React, Inertia, and Laravel artifacts. Install items directly into a shadcn-enabled app by URL; no repo checkout is part of the consumer path.

## Registry

Open the hosted registry page and copy the command for the item you want. Each command follows the shadcn CLI registry item format:

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/<item-name>.json
```

The registry index is served at:

```txt
https://your-registry-origin/r/registry.json
```

## Items

### useDecorator

A typed helper hook for selecting decoration metadata by value.

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/use-decorator.json
```

Targets:

- `hooks/use-decorator.ts`
- `resources/js/types/decoration.ts`

Dependencies:

- `@phosphor-icons/react`

### DropSchemas Artisan Command

A local-only Artisan command for dropping non-system PostgreSQL schemas on local and phpunit testing databases.

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/drop-schemas.json
```

Target:

- `app/Console/Commands/DropSchemas.php`

## Laravel

For Laravel projects that do not already have shadcn configured, initialize shadcn with the Laravel template first: `pnpm dlx shadcn@latest init --template laravel`.
