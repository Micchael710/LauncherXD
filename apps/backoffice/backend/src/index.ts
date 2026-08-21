import { serve } from '@hono/node-server';
import { createApp } from './app';

const app = createApp();
const port = 3000;
console.log(`Server is running on http://127.0.0.1:${port}`);
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
