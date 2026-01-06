import { Hono } from 'hono';
import { pinoLogger } from '@cascade/logger';
import { initKafka } from './kafka';
import 'dotenv/config';

const app = new Hono();

app.use(pinoLogger());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'activity-service' }));

// Initialize Kafka consumer
initKafka().catch(console.error);

console.log(`Activity Service starting on port ${process.env.PORT || 3004}`);

export default {
  port: process.env.PORT || 3004,
  fetch: app.fetch,
};
