import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Bindings for Cloudflare Worker
type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Configuración sencilla de CORS para desarrollo.
// NOTA: Las políticas definitivas de origen se configurarán cuando 
// conozcamos los dominios del frontend, para no dejar '*' en endpoints sensibles.
app.use('*', cors())

// Endpoint básico de health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'launcherxd-api'
  })
})

// Endpoint para comprobar conexión real a D1
app.get('/health/db', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT 1 AS ok').all()
    
    if (results && results.length > 0) {
      return c.json({
        status: 'ok',
        database: 'connected'
      })
    }
    
    throw new Error('No results from DB')
  } catch (err) {
    // Error controlado sin exponer stack traces
    return c.json({
      status: 'error',
      database: 'disconnected',
      message: 'Failed to connect to the database'
    }, 500)
  }
})

// Rutas futuras preparadas en la arquitectura (NO IMPLEMENTADAS AÚN)
// app.get('/api/releases', ...)
// app.get('/api/releases/latest', ...)
// app.get('/api/manifest', ...)
// app.get('/api/news', ...)
// app.get('/api/status', ...)
// app.post('/api/auth', ...)
// app.use('/api/admin/*', ...)

export default app
