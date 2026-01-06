import {
  Kafka,
  type Producer,
  type Consumer,
  type EachMessagePayload,
} from "kafkajs";

export type { EachMessagePayload };

export class KafkaClient {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer | null = null;

  constructor(clientId: string, brokers: string[]) {
    this.kafka = new Kafka({
      clientId,
      brokers,
    });
    this.producer = this.kafka.producer();
  }

  async connectProducer() {
    await this.producer.connect();
  }

  async send(topic: string, message: any) {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async connectConsumer(
    groupId: string,
    topics: string[],
    fromBeginning: boolean = false
  ) {
    this.consumer = this.kafka.consumer({ groupId });
    await this.consumer.connect();

    // Subscribe to each topic with retry logic (topics may not exist yet)
    for (const topic of topics) {
      let retries = 0;
      const maxRetries = 10;
      const baseDelay = 1000; // 1 second

      while (retries < maxRetries) {
        try {
          await this.consumer.subscribe({ topic, fromBeginning });
          console.log(`Subscribed to topic: ${topic}`);
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          if (retries >= maxRetries) {
            console.error(
              `Failed to subscribe to topic ${topic} after ${maxRetries} attempts:`,
              error.message
            );
            throw error;
          }

          const delay = baseDelay * Math.pow(2, retries - 1); // Exponential backoff
          console.log(
            `Topic ${topic} not ready, retrying in ${delay}ms (attempt ${retries}/${maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  async consume(handler: (payload: EachMessagePayload) => Promise<void>) {
    if (!this.consumer) throw new Error("Consumer not connected");
    await this.consumer.run({
      eachMessage: handler,
    });
  }

  async disconnect() {
    await this.producer.disconnect();
    if (this.consumer) await this.consumer.disconnect();
  }
}
