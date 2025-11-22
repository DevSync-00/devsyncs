import { Redis as RedisClient } from 'ioredis';
import { config } from '../config.js';
import { logger } from '../logger.js';

export const redis = new RedisClient(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (error) => {
  logger.error({ err: error }, 'Redis connection error');
});

redis.on('ready', () => {
  logger.info('Redis connection established');
});

