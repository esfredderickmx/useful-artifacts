import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  Atom,
  Blocks,
  Check,
  Code,
  Copy,
  ExternalLink,
  FileJson,
  FileText,
  Flame,
  GitBranch,
  Info,
  Keyboard,
  Layers,
  Link2,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Target,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type RegistryItem = {
  name: string
  type: string
  title?: string
  description?: string
  files?: RegistryFile[]
  registryDependencies?: string[]
  dependencies?: string[]
}

type RegistryFile = {
  path: string
  type: string
  target?: string
}

type RegistryIndex = {
  name: string
  homepage?: string
  items: RegistryItem[]
}

type RegistryState =
  | { status: "loading" }
  | { status: "ready"; registry: RegistryIndex }
  | { status: "error"; message: string }

type CopyState = { key: string; status: "copied" | "error" } | null
type Theme = "light" | "dark"
type IconComponent = LucideIcon
type RevealStyle = CSSProperties & { "--index": number }

type RegistryGroup = {
  style: string
  label: string
  description: string
  items: RegistryItem[]
}

type StyleDetail = {
  label: string
  description: string
  badgeClass: string
  iconWrapClass: string
  panelClass: string
  icon: IconComponent
}

const registryUrl = "/r/registry.json"
const repositoryUrl = "https://github.com/esfredderickmx/useful-artifacts"

const styleDetails: Record<string, StyleDetail> = {
  react: {
    label: "React",
    description: "Hooks, types, and client utilities for React, Inertia, and Vite surfaces.",
    badgeClass:
      "border-[color:var(--react-border)] bg-[var(--react-soft)] text-[var(--react-foreground)]",
    iconWrapClass:
      "border-[color:var(--react-border)] bg-[var(--react-soft)] text-[var(--react-foreground)]",
    panelClass:
      "border-[color:var(--react-border)] bg-[var(--react-soft)] text-[var(--react-foreground)]",
    icon: Atom,
  },
  laravel: {
    label: "Laravel",
    description: "Framework files that land directly in Laravel application structure.",
    badgeClass:
      "border-[color:var(--laravel-border)] bg-[var(--laravel-soft)] text-[var(--laravel-foreground)]",
    iconWrapClass:
      "border-[color:var(--laravel-border)] bg-[var(--laravel-soft)] text-[var(--laravel-foreground)]",
    panelClass:
      "border-[color:var(--laravel-border)] bg-[var(--laravel-soft)] text-[var(--laravel-foreground)]",
    icon: Flame,
  },
  general: {
    label: "General",
    description: "Registry artifacts that are not tied to one framework source folder.",
    badgeClass:
      "border-[color:var(--general-border)] bg-[var(--general-soft)] text-[var(--general-foreground)]",
    iconWrapClass:
      "border-[color:var(--general-border)] bg-[var(--general-soft)] text-[var(--general-foreground)]",
    panelClass:
      "border-[color:var(--general-border)] bg-[var(--general-soft)] text-[var(--general-foreground)]",
    icon: Layers,
  },
}

const contractItems = [
  {
    icon: Link2,
    title: "Install by URL",
    description: "Each card points to a generated /r/name.json item payload.",
  },
  {
    icon: Target,
    title: "Explicit targets",
    description: "File destinations are visible before the CLI writes anything.",
  },
  {
    icon: Zap,
    title: "Deps included",
    description: "Package and registry dependencies travel with the manifest.",
  },
]

function registryStyleFor(item: RegistryItem): string {
  const sourcePath = item.files?.[0]?.path

  if (!sourcePath) {
    return "general"
  }

  const [root, style] = sourcePath.split("/")

  return root === "registry" && style ? style : "general"
}

function styleLabel(style: string): string {
  return (
    styleDetails[style]?.label ??
    style
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  )
}

function styleDescription(style: string): string {
  return styleDetails[style]?.description ?? `Artifacts sourced from registry/${style}.`
}

function styleDetailFor(style: string): StyleDetail {
  return (
    styleDetails[style] ?? {
      ...styleDetails.general,
      label: styleLabel(style),
      description: styleDescription(style),
    }
  )
}

function groupRegistryItems(items: RegistryItem[]): RegistryGroup[] {
  const groups = new Map<string, RegistryItem[]>()

  for (const item of items) {
    const style = registryStyleFor(item)
    const styleItems = groups.get(style) ?? []

    styleItems.push(item)
    groups.set(style, styleItems)
  }

  return Array.from(groups, ([style, styleItems]) => ({
    style,
    label: styleLabel(style),
    description: styleDescription(style),
    items: styleItems,
  }))
}

function fileDestination(file: RegistryFile): string {
  if (file.target) {
    return file.target
  }

  const parts = file.path.split("/")

  if (parts[0] === "registry" && parts.length > 2) {
    return parts.slice(2).join("/")
  }

  return file.path
}

function itemTargets(item: RegistryItem): string[] {
  return item.files?.map(fileDestination) ?? []
}

function itemDependencies(item: RegistryItem): string[] {
  return [...(item.registryDependencies ?? []), ...(item.dependencies ?? [])]
}

function itemInstallUrl(origin: string, item: RegistryItem): string {
  return `${origin}/r/${item.name}.json`
}

function itemInstallCommand(origin: string, item: RegistryItem): string {
  return `pnpm dlx shadcn@latest add ${itemInstallUrl(origin, item)}`
}

function formatType(type: string): string {
  return type.replace("registry:", "")
}

function itemSearchText(item: RegistryItem): string {
  return [
    item.name,
    item.title,
    item.description,
    item.type,
    registryStyleFor(item),
    ...itemTargets(item),
    ...itemDependencies(item),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light"
  }

  const storedTheme = window.localStorage.getItem("registry-theme")

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function revealStyle(index: number): RevealStyle {
  return { "--index": index }
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")

  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()

  const didCopy = document.execCommand("copy")

  document.body.removeChild(textarea)

  if (!didCopy) {
    throw new Error("Clipboard copy failed")
  }
}

function CopyButton({
  children = "Copy",
  className,
  compact = false,
  copyKey,
  copyState,
  iconOnly = false,
  inverse = false,
  value,
  onCopy,
}: {
  children?: ReactNode
  className?: string
  compact?: boolean
  copyKey: string
  copyState: CopyState
  iconOnly?: boolean
  inverse?: boolean
  value: string
  onCopy: (copyKey: string, value: string) => void
}) {
  const activeState = copyState?.key === copyKey ? copyState.status : null
  const label = activeState === "copied" ? "Copied" : activeState === "error" ? "Retry" : children
  const Icon = activeState === "copied" ? Check : activeState === "error" ? RefreshCw : Copy
  const button = (
    <Button
      aria-label={iconOnly ? String(label) : undefined}
      className={cn(
        inverse &&
          "border-[color:var(--code-border)] bg-white/10 text-[var(--code-foreground)] hover:bg-white/15 hover:text-[var(--code-foreground)]",
        className
      )}
      onClick={() => onCopy(copyKey, value)}
      size={iconOnly ? (compact ? "icon-xs" : "icon-sm") : compact ? "sm" : "default"}
      type="button"
      variant={activeState === "error" ? "destructive" : "outline"}
    >
      <Icon data-icon={iconOnly ? undefined : "inline-start"} />
      {!iconOnly && <span aria-live="polite">{label}</span>}
    </Button>
  )

  if (!iconOnly) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark"
  const label = isDark ? "Use light theme" : "Use dark theme"
  const Icon = isDark ? Sun : Moon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={isDark}
          onClick={onToggle}
          size="icon-lg"
          type="button"
          variant="outline"
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function CodeBlock({
  copyKey,
  copyState,
  hints = ["pnpm", "shadcn"],
  label,
  value,
  onCopy,
}: {
  copyKey: string
  copyState: CopyState
  hints?: string[]
  label: string
  value: string
  onCopy: (copyKey: string, value: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--code-border)] bg-[var(--code)] text-[var(--code-foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--code-border)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            className="h-6 border-[color:var(--code-border)] bg-white/10 text-[var(--code-foreground)]"
            variant="outline"
          >
            <Code data-icon="inline-start" />
            {label}
          </Badge>
          <KbdGroup className="hidden sm:inline-flex">
            {hints.map((hint) => (
              <Kbd
                className="bg-white/10 text-[var(--code-muted)] ring-1 ring-[var(--code-border)]"
                key={hint}
              >
                {hint}
              </Kbd>
            ))}
          </KbdGroup>
        </div>
        <CopyButton
          compact
          copyKey={copyKey}
          copyState={copyState}
          iconOnly
          inverse
          onCopy={onCopy}
          value={value}
        />
      </div>
      <pre className="overflow-x-auto px-3 py-3">
        <code className="font-mono text-[0.82rem] leading-6 text-[var(--code-foreground)]">
          {value}
        </code>
      </pre>
    </div>
  )
}

function LoadingCatalog() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Card className="registry-reveal shadow-[0_18px_46px_-34px_var(--elevation-color)]" key={index} style={revealStyle(index)}>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-3/5" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-20 w-full" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardHeader>
        <Badge className="w-fit" variant="outline">
          <Info data-icon="inline-start" />
          No results
        </Badge>
        <CardTitle className="text-2xl">
          {query ? "No registry items match this filter." : "No registry items are published yet."}
        </CardTitle>
        {query && (
          <CardDescription>
            Clear the filter or search by framework, target path, dependency, or item name.
          </CardDescription>
        )}
      </CardHeader>
      {query && (
        <CardFooter>
          <Button onClick={onClear} type="button" variant="outline">
            <X data-icon="inline-start" />
            Clear search
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

export function App() {
  const [registryState, setRegistryState] = useState<RegistryState>({ status: "loading" })
  const [query, setQuery] = useState("")
  const [copyState, setCopyState] = useState<CopyState>(null)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const resetTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    async function loadRegistry() {
      try {
        const response = await fetch(registryUrl)

        if (!response.ok) {
          throw new Error(`Registry request failed with ${response.status}`)
        }

        const registry = (await response.json()) as RegistryIndex

        if (isMounted) {
          setRegistryState({ status: "ready", registry })
        }
      } catch (error) {
        if (isMounted) {
          setRegistryState({
            status: "error",
            message: error instanceof Error ? error.message : "Could not load the registry.",
          })
        }
      }
    }

    loadRegistry()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement

    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
    window.localStorage.setItem("registry-theme", theme)
  }, [theme])

  useEffect(() => {
    return () => {
      window.clearTimeout(resetTimer.current)
    }
  }, [])

  const origin = typeof window === "undefined" ? "http://localhost:5173" : window.location.origin
  const registryEndpoint = `${origin}${registryUrl}`
  const readyItems = registryState.status === "ready" ? registryState.registry.items : []
  const normalizedQuery = query.trim().toLowerCase()
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return readyItems
    }

    return readyItems.filter((item) => itemSearchText(item).includes(normalizedQuery))
  }, [normalizedQuery, readyItems])
  const registryGroups = useMemo(() => groupRegistryItems(filteredItems), [filteredItems])
  const installCommands = filteredItems.map((item) => itemInstallCommand(origin, item))
  const allInstallCommands = installCommands.join("\n")
  const itemCount = readyItems.length
  const fileCount = readyItems.reduce((total, item) => total + (item.files?.length ?? 0), 0)
  const dependencyCount = new Set(readyItems.flatMap(itemDependencies)).size
  const statItems = [
    { label: "Items", value: registryState.status === "ready" ? itemCount : "...", icon: Blocks },
    { label: "Files", value: registryState.status === "ready" ? fileCount : "...", icon: FileText },
    { label: "Deps", value: registryState.status === "ready" ? dependencyCount : "...", icon: Zap },
  ]

  async function handleCopy(copyKey: string, value: string) {
    try {
      await copyToClipboard(value)
      setCopyState({ key: copyKey, status: "copied" })
    } catch {
      setCopyState({ key: copyKey, status: "error" })
    }

    window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState(null), 1800)
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-7">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <a className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight" href="/">
              <span className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-foreground">
                <Blocks className="size-3.5" />
              </span>
              Useful Artifacts
            </a>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button asChild size="sm" variant="ghost">
                <a href={registryUrl}>
                  <FileJson data-icon="inline-start" />
                  registry.json
                </a>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild aria-label="Open repository" size="icon-lg" variant="ghost">
                    <a href={repositoryUrl} rel="noreferrer" target="_blank">
                      <GitBranch />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open repository</TooltipContent>
              </Tooltip>
              <ThemeToggle
                onToggle={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
                theme={theme}
              />
            </div>
          </nav>
          <Separator />

          <section className="grid min-h-[62dvh] items-end gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
            <div className="max-w-4xl pb-3 pt-12 lg:pb-10 lg:pt-20">
              <Badge
                className="h-7 border-[color:var(--info-border)] bg-[var(--info-soft)] text-[var(--info-foreground)]"
                variant="outline"
              >
                <Keyboard data-icon="inline-start" />
                shadcn registry
              </Badge>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-none tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Useful artifacts installed straight into your app.
              </h1>
              <p className="mt-5 max-w-[64ch] text-base leading-8 text-muted-foreground sm:text-lg">
                Hooks, framework files, and typed helpers delivered as registry JSON. Use the
                item URL, let the shadcn CLI write the files, and skip the repo checkout.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  className="hover:opacity-90"
                  size="lg"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  <a href={repositoryUrl} rel="noreferrer" target="_blank">
                    <GitBranch data-icon="inline-start" />
                    Open repo
                  </a>
                </Button>
                <CopyButton
                  copyKey="registry-endpoint-hero"
                  copyState={copyState}
                  onCopy={handleCopy}
                  value={registryEndpoint}
                >
                  Copy endpoint
                </CopyButton>
              </div>

              <dl className="mt-8 grid max-w-2xl grid-cols-1 overflow-hidden rounded-lg border border-border bg-card shadow-[0_20px_55px_-38px_var(--elevation-color)] sm:grid-cols-3 sm:divide-x sm:divide-border">
                {statItems.map((stat) => {
                  const StatIcon = stat.icon

                  return (
                    <div className="flex items-center gap-3 p-4" key={stat.label}>
                      <span className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                        <StatIcon />
                      </span>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-muted-foreground">{stat.label}</dt>
                        <dd className="mt-1 font-mono text-2xl text-foreground">{stat.value}</dd>
                      </div>
                    </div>
                  )
                })}
              </dl>
            </div>

            <Card className="relative bg-card/90 shadow-[0_26px_60px_-36px_var(--elevation-color)]">
              <CardHeader>
                <Badge className="w-fit" variant="secondary">
                  <Link2 data-icon="inline-start" />
                  Registry endpoint
                </Badge>
                <CardTitle className="text-2xl">Public JSON index</CardTitle>
                <CardDescription>Copy once, install individual artifacts from the cards below.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <CodeBlock
                  copyKey="registry-endpoint"
                  copyState={copyState}
                  hints={["url", "json"]}
                  label="endpoint"
                  onCopy={handleCopy}
                  value={registryEndpoint}
                />
                <div className="grid gap-2">
                  {registryState.status === "ready" &&
                    groupRegistryItems(readyItems).map((group) => {
                      const detail = styleDetailFor(group.style)
                      const StyleIcon = detail.icon

                      return (
                        <div
                          className={cn(
                            "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2.5",
                            detail.panelClass
                          )}
                          key={group.style}
                        >
                          <span className={cn("inline-flex size-7 items-center justify-center rounded-md", detail.iconWrapClass)}>
                            <StyleIcon />
                          </span>
                          <span className="truncate text-sm font-semibold">{group.label}</span>
                          <span className="font-mono text-sm">{group.items.length}</span>
                        </div>
                      )
                    })}
                  {registryState.status === "loading" && <Skeleton className="h-20 w-full" />}
                  {registryState.status === "error" && (
                    <Alert variant="destructive">
                      <TriangleAlert />
                      <AlertTitle>Registry unavailable</AlertTitle>
                      <AlertDescription>{registryState.message}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </header>

        <Separator />

        <section className="grid gap-5 lg:grid-cols-[minmax(240px,0.36fr)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Badge
              className="border-[color:var(--info-border)] bg-[var(--info-soft)] text-[var(--info-foreground)]"
              variant="outline"
            >
              <Code data-icon="inline-start" />
              Install commands
            </Badge>
            <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-foreground">
              Copy the exact command for each item.
            </h2>
            <label className="mt-5 flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">Search catalog</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-8 pr-9"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="React, Laravel, target path"
                  type="search"
                  value={query}
                />
                {query && (
                  <Button
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setQuery("")}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <X />
                  </Button>
                )}
              </div>
            </label>
            {filteredItems.length > 1 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <CopyButton
                  className="text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5"
                  copyKey="all-visible"
                  copyState={copyState}
                  onCopy={handleCopy}
                  value={allInstallCommands}
                >
                  Copy visible
                </CopyButton>
                <Badge variant="secondary">{filteredItems.length} commands</Badge>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {registryState.status === "loading" && <LoadingCatalog />}

            {registryState.status === "error" && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Registry unavailable</AlertTitle>
                <AlertDescription>{registryState.message}</AlertDescription>
              </Alert>
            )}

            {registryState.status === "ready" && filteredItems.length === 0 && (
              <EmptyState onClear={() => setQuery("")} query={query} />
            )}

            {registryState.status === "ready" &&
              filteredItems.map((item, index) => {
                const style = registryStyleFor(item)
                const detail = styleDetailFor(style)
                const StyleIcon = detail.icon
                const installUrl = itemInstallUrl(origin, item)
                const command = itemInstallCommand(origin, item)
                const dependencies = itemDependencies(item)

                return (
                  <Card
                    className="registry-reveal border-border/80 bg-card/95 shadow-[0_18px_46px_-34px_var(--elevation-color)] transition-transform duration-300 hover:-translate-y-0.5"
                    key={item.name}
                    style={revealStyle(index)}
                  >
                    <CardHeader>
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg border", detail.iconWrapClass)}>
                          <StyleIcon />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("h-6", detail.badgeClass)} variant="outline">
                              {detail.label}
                            </Badge>
                            <Badge variant="secondary">{formatType(item.type)}</Badge>
                          </div>
                          <CardTitle className="mt-3 text-2xl">{item.title ?? item.name}</CardTitle>
                        </div>
                      </div>
                      <CardAction>
                        <Button asChild size="sm" variant="outline">
                          <a href={installUrl}>
                            JSON
                            <ExternalLink data-icon="inline-end" />
                          </a>
                        </Button>
                      </CardAction>
                    </CardHeader>

                    <CardContent className="grid gap-4">
                      {item.description && (
                        <p className="max-w-[72ch] text-base leading-7 text-muted-foreground">
                          {item.description}
                        </p>
                      )}

                      <CodeBlock
                        copyKey={`install-${item.name}`}
                        copyState={copyState}
                        label="install"
                        onCopy={handleCopy}
                        value={command}
                      />

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                            <Target className="size-3.5" />
                            Targets
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {itemTargets(item).map((target) => (
                              <Badge
                                className="h-auto max-w-full justify-start rounded-md px-2.5 py-1 font-mono text-[0.72rem] whitespace-normal break-all"
                                key={target}
                                variant="outline"
                              >
                                {target}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                            <Zap className="size-3.5" />
                            Dependencies
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {dependencies.length > 0 ? (
                              dependencies.map((dependency) => (
                                <Badge
                                  className={cn(
                                    "h-auto max-w-full justify-start rounded-md px-2.5 py-1 font-mono text-[0.72rem] whitespace-normal break-all",
                                    detail.badgeClass
                                  )}
                                  key={dependency}
                                  variant="outline"
                                >
                                  {dependency}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="secondary">No deps</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </section>

        {registryState.status === "ready" && registryGroups.length > 0 && (
          <>
            <Separator />
            <section className="pb-8">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Badge
                    className="border-[color:var(--info-border)] bg-[var(--info-soft)] text-[var(--info-foreground)]"
                    variant="outline"
                  >
                    <Layers data-icon="inline-start" />
                    Catalog
                  </Badge>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                    Registry groups built to grow.
                  </h2>
                </div>
                <Badge variant="secondary">{filteredItems.length} visible items</Badge>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="grid gap-4">
                  {registryGroups.map((group, groupIndex) => {
                    const detail = styleDetailFor(group.style)
                    const StyleIcon = detail.icon

                    return (
                      <Card
                        className="registry-reveal shadow-[0_18px_46px_-34px_var(--elevation-color)]"
                        key={group.style}
                        style={revealStyle(groupIndex)}
                      >
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <span className={cn("inline-flex size-9 items-center justify-center rounded-lg border", detail.iconWrapClass)}>
                              <StyleIcon />
                            </span>
                            <div>
                              <CardTitle className="text-xl">{group.label}</CardTitle>
                              <CardDescription>{group.description}</CardDescription>
                            </div>
                          </div>
                          <CardAction>
                            <Badge className={detail.badgeClass} variant="outline">
                              {group.items.length}
                            </Badge>
                          </CardAction>
                        </CardHeader>
                        <CardContent>
                          <div className="divide-y divide-border border-t border-border">
                            {group.items.map((item) => (
                              <div
                                className="grid gap-2 py-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]"
                                key={item.name}
                              >
                                <div>
                                  <p className="font-semibold text-foreground">{item.title ?? item.name}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{formatType(item.type)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {itemTargets(item).map((target) => (
                                    <Badge
                                      className="h-auto max-w-full rounded-md px-2.5 py-1 font-mono text-[0.72rem] whitespace-normal break-all md:h-5 md:px-1.5 md:py-0 md:text-[0.66rem] md:leading-none"
                                      key={target}
                                      variant="secondary"
                                    >
                                      {target}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                <Card className="bg-[var(--surface-tint)] shadow-none">
                  <CardHeader>
                    <Badge className="w-fit" variant="outline">
                      <Info data-icon="inline-start" />
                      Consumer contract
                    </Badge>
                    <CardTitle>Predictable registry payloads</CardTitle>
                    <CardDescription>Small rules that keep installs inspectable.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {contractItems.map((contractItem) => {
                      const ContractIcon = contractItem.icon

                      return (
                        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3" key={contractItem.title}>
                          <span className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                            <ContractIcon className="size-4.5" />
                          </span>
                          <div>
                            <p className="font-semibold text-foreground">{contractItem.title}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {contractItem.description}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
