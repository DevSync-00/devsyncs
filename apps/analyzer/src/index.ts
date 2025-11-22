import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { registerDeviceStartRoute } from './api/auth/device/start.js';
import { registerDeviceTokenRoute } from './api/auth/device/token.js';
import { registerDeviceLookupRoute } from './api/auth/device/lookup.js';
import { registerDeviceApproveRoute } from './api/auth/device/approve.js';
import { registerRefreshTokenRoute } from './api/auth/token/refresh.js';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  await registerDeviceStartRoute(app);
  await registerDeviceTokenRoute(app);
  await registerDeviceLookupRoute(app);
  await registerDeviceApproveRoute(app);
  await registerRefreshTokenRoute(app);

  app.get('/healthz', async () => ({ status: 'ok' }));

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, 'Analyzer service listening');
  } catch (error) {
    logger.error(error, 'Failed to start analyzer service');
    process.exit(1);
  }
}

start();

