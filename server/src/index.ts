import { createApp } from './app.js'
import { storageReady } from './services/storage/index.js'

async function main(): Promise<void> {
  // Fail fast: invalid GRAPH_MODE, or GRAPH_MODE=live with blank AZURE_* vars,
  // aborts here with a clear message before the API starts accepting traffic.
  try {
    await storageReady()
  } catch (error) {
    console.error(`[startup] storage bootstrap failed: ${(error as Error).message}`)
    process.exit(1)
  }

  const app = createApp()
  const port = Number(process.env.PORT ?? 4000)
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
}

void main()
