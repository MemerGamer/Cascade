import {
  ReactiveKafkaConsumer,
  type KafkaEvent,
  tap,
  filter,
  map,
  catchError,
  EMPTY,
} from "@cascade/kafka";
import { GlobalLogger } from "@cascade/logger";
import "dotenv/config";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

const TOPICS = [
  "user.registered",
  "user.logged_in",
  "board.created",
  "task.created",
  "task.moved",
  "task.updated",
];

export const reactiveConsumer = new ReactiveKafkaConsumer(
  "activity-service",
  KAFKA_BROKERS
);

export async function initKafka() {
  await reactiveConsumer.connect("activity-group", TOPICS, false);

  // Create reactive event processing pipeline
  reactiveConsumer
    .getEventStream()
    .pipe(
      // Log incoming events
      tap((event) =>
        GlobalLogger.logger.debug(`Received event: ${event.topic}`)
      ),

      // Filter out events with missing data
      filter((event) => event.data !== null && event.data !== undefined),

      // Transform event for logging
      map((event) => ({
        event: event.topic,
        data: event.data,
        partition: event.partition,
        offset: event.offset,
        processedAt: new Date().toISOString(),
      })),

      // Handle errors gracefully
      catchError((err) => {
        GlobalLogger.logger.error(err, "Error in reactive stream");
        return EMPTY; // Continue stream on error
      })
    )
    .subscribe({
      next: (activity) => {
        // Log the processed activity
        GlobalLogger.logger.info(activity, `[ACTIVITY] ${activity.event}`);
      },
      error: (err) => {
        GlobalLogger.logger.error(err, "Fatal stream error");
      },
      complete: () => {
        GlobalLogger.logger.info("Activity stream completed");
      },
    });

  GlobalLogger.logger.info(
    "Reactive Activity consumer started - using RxJS Observable streams"
  );
}
