import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

app.use(cors({ origin: clientOrigin }))
app.use(express.json())

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'renuzi-stock-recon-api' })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
