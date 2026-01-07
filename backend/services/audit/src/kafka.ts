import { KafkaClient, type EachMessagePayload } from "@cascade/kafka";
import { AuditEvent } from "./models";
import { GlobalLogger } from "@cascade/logger";
import "dotenv/config";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(
  ","
);

export const kafkaClient = new KafkaClient("audit-service", KAFKA_BROKERS);

export async function initKafka() {
  await kafkaClient.connectConsumer(
    "audit-group",
    [
      "user.registered",
      "user.logged_in",
      "board.created",
      "task.created",
      "task.moved",
      "task.updated",
    ],
    false
  );

  await kafkaClient.consume(handleEvent);
  GlobalLogger.logger.info("Audit consumer started - storing immutable events");
}

async function handleEvent(payload: EachMessagePayload) {
  const { topic, message } = payload;
  const event = JSON.parse(message.value?.toString() || "{}");

  try {
    // Store immutable audit record
    await AuditEvent.create({
      eventType: topic,
      eventData: event,
      userId: event.userId || event.ownerId || null,
      timestamp: new Date(event.timestamp || Date.now()),
    });

    GlobalLogger.logger.info(`[AUDIT] Stored: ${topic}`);
  } catch (error) {
    GlobalLogger.logger.error(error, `Error storing audit event for ${topic}`);
  }
}
