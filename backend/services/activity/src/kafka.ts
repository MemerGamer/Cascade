import { KafkaClient, type EachMessagePayload } from "@cascade/kafka";
import "dotenv/config";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(
  ","
);

export const kafkaClient = new KafkaClient("activity-service", KAFKA_BROKERS);

export async function initKafka() {
  await kafkaClient.connectConsumer(
    "activity-group",
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
  console.log("Activity consumer started - logging all events");
}

async function handleEvent(payload: EachMessagePayload) {
  const { topic, message } = payload;
  const event = JSON.parse(message.value?.toString() || "{}");

  // Log activity
  console.log(`[ACTIVITY] ${topic}:`, {
    event: topic,
    data: event,
    processedAt: new Date().toISOString(),
  });

  // In a real system, you might store these in a time-series DB or send to analytics
}
