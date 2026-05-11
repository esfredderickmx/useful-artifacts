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

- `lucide-react`

### IconRenderer

A small lucide-backed renderer for icon components stored in decoration or metadata objects.

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/icon-renderer.json
```

Target:

- `components/icon-renderer.tsx`

Dependencies:

- `lucide-react`

### DropSchemas Artisan Command

A local-only Artisan command for dropping non-system PostgreSQL schemas on local and phpunit testing databases.

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/drop-schemas.json
```

Target:

- `app/Console/Commands/DropSchemas.php`

### AppException

Lets custom exceptions extend AppException to flash translatable alert or toast messages with a specific emphasis variant.

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/app-exception.json
```

Targets:

- `app/Exceptions/AppException.php`
- `app/Macros/InertiaNotify.php`
- `app/Enums/EmphasisVariant.php`
- `app/Enums/FlashResponse.php`

Required setup:

Call the macro declaration from the `boot` method of a registered service provider because the shadcn CLI cannot register it automatically.

```php
use App\Macros\InertiaNotify;

public function boot(): void
{
    InertiaNotify::declare();
}
```

### Emphasis Colors (Full)

A full semantic emphasis color layer with surface, foreground, and emphasis tokens for destructive, affirmative, informative, preventive, and interrogative states. This variant replaces `destructive` tokens.

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/emphasis-colors-full.json
```

CSS variables:

- `destructive`, `affirmative`, `informative`, `preventive`, `interrogative`
- `destructive-foreground`, `affirmative-foreground`, `informative-foreground`, `preventive-foreground`, `interrogative-foreground`
- `destructive-emphasis`, `affirmative-emphasis`, `informative-emphasis`, `preventive-emphasis`, `interrogative-emphasis`

### Emphasis Colors (Simple)

A lightweight semantic emphasis color layer that adds affirmative, informative, preventive, and interrogative tokens without replacing `destructive`.

```bash
pnpm dlx shadcn@latest add https://your-registry-origin/r/emphasis-colors-simple.json
```

CSS variables:

- `affirmative`, `informative`, `preventive`, `interrogative`

## Laravel

For Laravel projects that do not already have shadcn configured, initialize shadcn with the Laravel template first: `pnpm dlx shadcn@latest init --template laravel`.
