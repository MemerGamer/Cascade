import { Hono } from 'hono';
import { pinoLogger } from '@cascade/logger';
import { initKafka } from './kafka';
import 'dotenv/config';

const app = new Hono();

app.use(pinoLogger());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'audit-service' }));

// Initialize Kafka consumer
initKafka().catch(console.error);

console.log(`Audit Service starting on port ${process.env.PORT || 3005}`);

export default {
  port: process.env.PORT || 3005,
  fetch: app.fetch,
};
