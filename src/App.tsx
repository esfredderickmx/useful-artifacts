import { useEffect, useState } from "react"

type RegistryItem = {
  name: string
  type: string
  title?: string
  description?: string
  registryDependencies?: string[]
  dependencies?: string[]
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
            <p className="muted">No registry items yet. Add source files under registry/new-york.</p>
          )}

          {registryState.status === "ready" && registryState.registry.items.length > 0 && (
            <div className="item-list">
              {registryState.registry.items.map((item) => (
                <article className="registry-item" key={item.name}>
                  <div>
                    <p className="item-type">{item.type}</p>
                    <h3>{item.title ?? item.name}</h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <div className="tag-row">
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
