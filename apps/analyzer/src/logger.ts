import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  name: 'devsync-analyzer',
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'SYS:standard',
            singleLine: false,
          },
        }
      : undefined,
});

