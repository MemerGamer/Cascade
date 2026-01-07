import { KafkaClient } from "@cascade/kafka";
import { GlobalLogger } from "@cascade/logger";
import "dotenv/config";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(
  ","
);

export const kafkaClient = new KafkaClient("auth-service", KAFKA_BROKERS);

export async function initKafka() {
  await kafkaClient.connectProducer();
  GlobalLogger.logger.info("Kafka producer connected");
}

export async function publishUserRegistered(
  userId: string,
  email: string,
  name: string
) {
  await kafkaClient.send("user.registered", {
    userId,
    email,
    name,
    timestamp: new Date().toISOString(),
  });
}

export async function publishUserLoggedIn(userId: string, email: string) {
  await kafkaClient.send("user.logged_in", {
    userId,
    email,
    timestamp: new Date().toISOString(),
  });
}
