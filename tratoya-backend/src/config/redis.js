const { createClient } = require('redis');
const logger = require('../utils/logger');

let client;

async function connectRedis() {
  client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  client.on('error', err => logger.error('Redis error: ' + err.message));
  await client.connect();
  return client;
}

const getRedis = () => client;

module.exports = { connectRedis, getRedis };
