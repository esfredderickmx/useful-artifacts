import { useEffect, useState } from "react"

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

const registryUrl = "/r/registry.json"

const styleDetails: Record<string, { label: string; description: string }> = {
  react: {
    label: "React",
    description: "Hooks, types, and frontend utilities for React, Inertia, and Vite surfaces.",
  },
  laravel: {
    label: "Laravel",
    description: "PHP artifacts that land directly in Laravel app structure.",
  },
  general: {
    label: "General",
    description: "Registry artifacts that do not belong to a framework-specific source folder.",
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

function groupRegistryItems(items: RegistryItem[]) {
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

function itemTargets(item: RegistryItem): string[] {
  return item.files?.flatMap((file) => (file.target ? [file.target] : [])) ?? []
}

export function App() {
  const [registryState, setRegistryState] = useState<RegistryState>({ status: "loading" })

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

  const origin = typeof window === "undefined" ? "http://localhost:5173" : window.location.origin
  const registryEndpoint = `${origin}${registryUrl}`
  const itemCount = registryState.status === "ready" ? registryState.registry.items.length : 0
  const registryGroups =
    registryState.status === "ready" ? groupRegistryItems(registryState.registry.items) : []

  return (
    <main className="app-shell">
      <header className="page-header">
        <div className="title-stack">
          <p className="eyebrow">shadcn/ui registry</p>
          <h1>Useful Artifacts</h1>
          <p className="lede">
            A TypeScript React workspace for building registry-backed components and views for
            Laravel, Inertia, and Vite projects.
          </p>
        </div>
        <div className="status-panel" aria-live="polite">
          <span className="status-dot" />
          {registryState.status === "ready"
            ? `${itemCount} ${itemCount === 1 ? "item" : "items"} ready`
            : registryState.status === "error"
              ? "Registry offline"
              : "Loading registry"}
        </div>
      </header>

      <section className="command-strip" aria-label="Registry endpoint">
        <span>Registry URL</span>
        <code>{registryEndpoint}</code>
      </section>

      <section className="content-grid">
        <div className="registry-panel">
          <div className="panel-heading">
            <h2>Registry Items</h2>
            <a href={registryUrl}>View JSON</a>
          </div>

          {registryState.status === "loading" && <p className="muted">Loading registry index...</p>}

          {registryState.status === "error" && <p className="muted">{registryState.message}</p>}

          {registryState.status === "ready" && registryState.registry.items.length === 0 && (
            <p className="muted">No registry items yet. Add source files under registry/&lt;style&gt;.</p>
          )}

          {registryState.status === "ready" && registryState.registry.items.length > 0 && (
            <div className="style-list">
              {registryGroups.map((group) => (
                <section className="style-section" data-style={group.style} key={group.style}>
                  <div className="style-heading">
                    <div>
                      <p className="style-kicker">Style</p>
                      <h3>{group.label}</h3>
                      <p>{group.description}</p>
                    </div>
                    <span className="style-count">
                      {group.items.length} {group.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="item-list">
                    {group.items.map((item) => {
                      const targets = itemTargets(item)

                      return (
                        <article className="registry-item" key={item.name}>
                          <div>
                            <p className="item-type">{item.type}</p>
                            <h4>{item.title ?? item.name}</h4>
                            {item.description && <p>{item.description}</p>}
                          </div>
                          <div className="tag-row">
                            {targets.map((target) => (
                              <span className="tag tag-target" key={target}>
                                {target}
                              </span>
                            ))}
                            {(item.registryDependencies ?? []).map((dependency) => (
                              <span className="tag" key={dependency}>
                                {dependency}
                              </span>
                            ))}
                            {(item.dependencies ?? []).map((dependency) => (
                              <span className="tag tag-muted" key={dependency}>
                                {dependency}
                              </span>
                            ))}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="workflow-panel">
          <h2>Workflow</h2>
          <ol>
            <li>
              <code>pnpm registry:build</code>
              <span>Generate JSON payloads in public/r.</span>
            </li>
            <li>
              <code>pnpm dev</code>
              <span>Serve the React app and registry files.</span>
            </li>
            <li>
              <code>pnpm build</code>
              <span>Type-check, build the registry, and bundle the app.</span>
            </li>
          </ol>
        </aside>
      </section>
    </main>
  )
}
