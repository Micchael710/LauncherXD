import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { releasesApp } from './routes/releases'
import { newsApp } from './routes/news'
import { settingsApp } from './routes/settings'
import { Bindings } from './types'
import { GitHubReleaseProvider } from './services/providers/github-release-provider'

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

// Endpoint para comprobar conexión real a GitHub Releases
app.get('/health/github', async (c) => {
  try {
    const provider = new GitHubReleaseProvider({
      owner: c.env.GITHUB_OWNER,
      repo: c.env.GITHUB_RELEASES_REPO,
      token: c.env.GITHUB_TOKEN
    });

    const isConnected = await provider.checkConnection();
    if (isConnected) {
      return c.json({
        status: 'ok',
        github: 'connected'
      });
    }
    throw new Error('github_unavailable');
  } catch (err) {
    return c.json({
      status: 'error',
      github: 'unavailable'
    }, 500);
  }
})

import adminApp from './routes/admin'
import { adminAuth } from './middleware/admin-auth'

// Módulos públicos
app.route('/api/releases', releasesApp)
app.route('/api/news', newsApp)
app.route('/api/settings', settingsApp)

// Módulos protegidos administrativamente
app.use('/api/admin/*', adminAuth())
app.route('/api/admin', adminApp)

export default app
