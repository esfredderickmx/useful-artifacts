import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"

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

type RegistryGroup = {
  style: string
  label: string
  description: string
  items: RegistryItem[]
}

const registryUrl = "/r/registry.json"

const styleDetails: Record<string, { label: string; description: string; accent: string }> = {
  react: {
    label: "React",
    description: "Hooks, types, and client utilities for React, Inertia, and Vite surfaces.",
    accent: "bg-teal-700",
  },
  laravel: {
    label: "Laravel",
    description: "Framework files that land directly in Laravel application structure.",
    accent: "bg-rose-700",
  },
  general: {
    label: "General",
    description: "Registry artifacts that are not tied to one framework source folder.",
    accent: "bg-zinc-700",
  },
}

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

function styleAccent(style: string): string {
  return styleDetails[style]?.accent ?? styleDetails.general.accent
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
  copyKey,
  copyState,
  value,
  onCopy,
}: {
  children?: ReactNode
  copyKey: string
  copyState: CopyState
  value: string
  onCopy: (copyKey: string, value: string) => void
}) {
  const activeState = copyState?.key === copyKey ? copyState.status : null
  const label = activeState === "copied" ? "Copied" : activeState === "error" ? "Retry" : children

  return (
    <button
      className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 shadow-[0_1px_0_rgba(24,24,27,0.05)] transition duration-300 hover:border-zinc-400 hover:bg-zinc-50 active:-translate-y-px"
      onClick={() => onCopy(copyKey, value)}
      type="button"
    >
      <span aria-live="polite">{label}</span>
    </button>
  )
}

function LoadingCatalog() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_14px_34px_-28px_rgba(24,24,27,0.35)]"
          key={index}
        >
          <div className="mb-4 h-3 w-28 rounded-full bg-zinc-200" />
          <div className="mb-2 h-5 w-1/2 rounded-full bg-zinc-200" />
          <div className="h-3 w-4/5 rounded-full bg-zinc-100" />
          <div className="mt-4 h-11 rounded-md bg-zinc-100" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-zinc-600">
      <p className="text-sm font-semibold uppercase text-zinc-500">No results</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        {query ? "No registry items match this filter." : "No registry items are published yet."}
      </h3>
    </div>
  )
}

export function App() {
  const [registryState, setRegistryState] = useState<RegistryState>({ status: "loading" })
  const [query, setQuery] = useState("")
  const [copyState, setCopyState] = useState<CopyState>(null)
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
    <main className="min-h-[100dvh] overflow-hidden bg-[#f6f8fb] text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-7">
          <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
            <a className="text-sm font-bold tracking-tight" href="/">
              Useful Artifacts
            </a>
            <div className="flex items-center gap-2 text-sm">
              <a
                className="rounded-md px-2.5 py-1.5 font-semibold text-zinc-600 transition hover:bg-white hover:text-zinc-950"
                href={registryUrl}
              >
                registry.json
              </a>
              <span
                className="inline-flex min-h-8 items-center gap-2 rounded-md border border-teal-700/20 bg-teal-700/10 px-2.5 text-sm font-semibold text-teal-900"
                aria-live="polite"
              >
                <span className="h-2 w-2 rounded-full bg-teal-700 shadow-[0_0_0_4px_rgba(15,118,110,0.12)]" />
                {registryState.status === "ready"
                  ? `${itemCount} ${itemCount === 1 ? "item" : "items"}`
                  : registryState.status === "error"
                    ? "Offline"
                    : "Loading"}
              </span>
            </div>
          </nav>

          <section className="grid min-h-[62dvh] items-end gap-6 lg:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)]">
            <div className="max-w-4xl pb-3 pt-12 lg:pb-10 lg:pt-20">
              <p className="text-sm font-bold uppercase text-teal-800">shadcn registry</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-none tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                Useful artifacts installed straight into your app.
              </h1>
              <p className="mt-5 max-w-[64ch] text-base leading-8 text-zinc-600 sm:text-lg">
                Hooks, framework files, and typed helpers delivered as registry JSON. Use the
                item URL, let the shadcn CLI write the files, and skip the repo checkout.
              </p>

              <dl className="mt-8 grid max-w-2xl grid-cols-3 divide-x divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-[0_20px_55px_-38px_rgba(24,24,27,0.5)]">
                <div className="p-4">
                  <dt className="text-xs font-bold uppercase text-zinc-500">Items</dt>
                  <dd className="mt-2 font-mono text-2xl text-zinc-950">{itemCount}</dd>
                </div>
                <div className="p-4">
                  <dt className="text-xs font-bold uppercase text-zinc-500">Files</dt>
                  <dd className="mt-2 font-mono text-2xl text-zinc-950">{fileCount}</dd>
                </div>
                <div className="p-4">
                  <dt className="text-xs font-bold uppercase text-zinc-500">Deps</dt>
                  <dd className="mt-2 font-mono text-2xl text-zinc-950">{dependencyCount}</dd>
                </div>
              </dl>
            </div>

            <aside className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 p-5 text-white shadow-[0_26px_60px_-36px_rgba(24,24,27,0.8)]">
              <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-teal-200">Registry endpoint</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Public JSON index</h2>
                </div>
                <CopyButton
                  copyKey="registry-endpoint"
                  copyState={copyState}
                  onCopy={handleCopy}
                  value={registryEndpoint}
                />
              </div>
              <code className="mt-5 block overflow-x-auto rounded-md border border-white/10 bg-white/10 p-4 font-mono text-sm leading-6 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {registryEndpoint}
              </code>
              <div className="mt-6 grid gap-3">
                {registryState.status === "ready" &&
                  groupRegistryItems(readyItems).map((group) => (
                    <div
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2.5"
                      key={group.style}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${styleAccent(group.style)}`} />
                      <span className="truncate text-sm font-semibold text-zinc-100">{group.label}</span>
                      <span className="font-mono text-sm text-zinc-300">{group.items.length}</span>
                    </div>
                  ))}
                {registryState.status === "loading" && (
                  <div className="h-20 animate-pulse rounded-md border border-white/10 bg-white/[0.06]" />
                )}
                {registryState.status === "error" && (
                  <p className="rounded-md border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                    {registryState.message}
                  </p>
                )}
              </div>
            </aside>
          </section>
        </header>

        <section className="grid gap-5 border-t border-zinc-200 pt-8 lg:grid-cols-[minmax(240px,0.36fr)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <p className="text-sm font-bold uppercase text-teal-800">Install commands</p>
            <h2 className="mt-2 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-zinc-950">
              Copy the exact command for each item.
            </h2>
            <label className="mt-5 block">
              <span className="text-sm font-semibold text-zinc-700">Search catalog</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="React, Laravel, target path"
                type="search"
                value={query}
              />
            </label>
            {filteredItems.length > 1 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <CopyButton
                  copyKey="all-visible"
                  copyState={copyState}
                  onCopy={handleCopy}
                  value={allInstallCommands}
                >
                  Copy visible
                </CopyButton>
                <span className="text-sm text-zinc-500">{filteredItems.length} commands</span>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {registryState.status === "loading" && <LoadingCatalog />}

            {registryState.status === "error" && (
              <div className="rounded-lg border border-rose-200 bg-white p-6 text-rose-900">
                <p className="text-sm font-bold uppercase">Registry unavailable</p>
                <p className="mt-2 text-base text-rose-800">{registryState.message}</p>
              </div>
            )}

            {registryState.status === "ready" && filteredItems.length === 0 && <EmptyState query={query} />}

            {registryState.status === "ready" &&
              filteredItems.map((item) => {
                const installUrl = itemInstallUrl(origin, item)
                const command = itemInstallCommand(origin, item)

                return (
                  <article
                    className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_18px_46px_-34px_rgba(24,24,27,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300"
                    key={item.name}
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${styleAccent(registryStyleFor(item))}`}
                          />
                          <span className="text-xs font-bold uppercase text-zinc-500">
                            {styleLabel(registryStyleFor(item))} / {formatType(item.type)}
                          </span>
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                          {item.title ?? item.name}
                        </h3>
                        {item.description && (
                          <p className="mt-2 max-w-[72ch] text-base leading-7 text-zinc-600">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <a
                        className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                        href={installUrl}
                      >
                        JSON
                      </a>
                    </div>

                    <div className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-950 p-3 text-white md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <code className="overflow-x-auto whitespace-nowrap font-mono text-sm text-zinc-100">
                        {command}
                      </code>
                      <CopyButton
                        copyKey={`install-${item.name}`}
                        copyState={copyState}
                        onCopy={handleCopy}
                        value={command}
                      />
                    </div>

                    <div className="grid gap-3 border-t border-zinc-100 pt-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase text-zinc-500">Targets</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {itemTargets(item).map((target) => (
                            <span
                              className="max-w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs text-zinc-700"
                              key={target}
                            >
                              {target}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-zinc-500">Dependencies</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {itemDependencies(item).length > 0 ? (
                            itemDependencies(item).map((dependency) => (
                              <span
                                className="max-w-full rounded-md border border-teal-700/20 bg-teal-700/10 px-2.5 py-1 font-mono text-xs text-teal-900"
                                key={dependency}
                              >
                                {dependency}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-zinc-500">None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
          </div>
        </section>

        {registryState.status === "ready" && registryGroups.length > 0 && (
          <section className="border-t border-zinc-200 py-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-teal-800">Catalog</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                  Registry groups built to grow.
                </h2>
              </div>
              <span className="font-mono text-sm text-zinc-500">{filteredItems.length} visible items</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="grid gap-4">
                {registryGroups.map((group) => (
                  <section
                    className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_18px_46px_-34px_rgba(24,24,27,0.5)]"
                    key={group.style}
                  >
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${styleAccent(group.style)}`} />
                          <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                            {group.label}
                          </h3>
                        </div>
                        <p className="mt-2 max-w-[68ch] leading-7 text-zinc-600">{group.description}</p>
                      </div>
                      <span className="inline-flex h-8 items-center rounded-md border border-zinc-200 px-2.5 font-mono text-sm text-zinc-600">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="mt-5 divide-y divide-zinc-100 border-t border-zinc-100">
                      {group.items.map((item) => (
                        <div
                          className="grid gap-2 py-4 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)]"
                          key={item.name}
                        >
                          <div>
                            <p className="font-semibold text-zinc-950">{item.title ?? item.name}</p>
                            <p className="mt-1 text-sm text-zinc-500">{formatType(item.type)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {itemTargets(item).map((target) => (
                              <span
                                className="max-w-full rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-700"
                                key={target}
                              >
                                {target}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <aside className="rounded-lg border border-zinc-200 bg-[#edf5f2] p-5">
                <p className="text-sm font-bold uppercase text-teal-900">Consumer contract</p>
                <div className="mt-4 grid gap-4">
                  <div className="border-t border-teal-900/10 pt-4">
                    <p className="font-semibold text-zinc-950">Install by URL</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">
                      Each card points to a generated `/r/name.json` item payload.
                    </p>
                  </div>
                  <div className="border-t border-teal-900/10 pt-4">
                    <p className="font-semibold text-zinc-950">Targets are explicit</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">
                      Target paths are shown before install so file placement is visible.
                    </p>
                  </div>
                  <div className="border-t border-teal-900/10 pt-4">
                    <p className="font-semibold text-zinc-950">Dependencies travel with items</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">
                      Package and registry dependencies are listed from the registry manifest.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
