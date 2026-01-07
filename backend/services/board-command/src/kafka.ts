import { KafkaClient } from "@cascade/kafka";
import { GlobalLogger } from "@cascade/logger";
import "dotenv/config";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(
  ","
);

export const kafkaClient = new KafkaClient(
  "board-command-service",
  KAFKA_BROKERS
);

export async function initKafka() {
  await kafkaClient.connectProducer();
  GlobalLogger.logger.info("Kafka producer connected");
}

// Board events
export async function publishBoardCreated(
  boardId: string,
  name: string,
  ownerId: string,
  visibility: string
) {
  await kafkaClient.send("board.created", {
    boardId,
    name,
    ownerId,
    visibility,
    timestamp: new Date().toISOString(),
  });
}

export async function publishBoardUpdated(boardId: string, updates: any) {
  await kafkaClient.send("board.updated", {
    boardId,
    updates,
    timestamp: new Date().toISOString(),
  });
}

export async function publishBoardDeleted(boardId: string) {
  await kafkaClient.send("board.deleted", {
    boardId,
    timestamp: new Date().toISOString(),
  });
}

// Task events
export async function publishTaskCreated(
  taskId: string,
  boardId: string,
  title: string,
  columnId: string
) {
  await kafkaClient.send("task.created", {
    taskId,
    boardId,
    title,
    columnId,
    timestamp: new Date().toISOString(),
  });
}

export async function publishTaskMoved(
  taskId: string,
  boardId: string,
  oldColumnId: string,
  newColumnId: string
) {
  await kafkaClient.send("task.moved", {
    taskId,
    boardId,
    oldColumnId,
    newColumnId,
    timestamp: new Date().toISOString(),
  });
}

export async function publishTaskUpdated(
  taskId: string,
  boardId: string,
  updates: any
) {
  await kafkaClient.send("task.updated", {
    taskId,
    boardId,
    updates,
    timestamp: new Date().toISOString(),
  });
}

export async function publishTaskDeleted(taskId: string, boardId: string) {
  await kafkaClient.send("task.deleted", {
    taskId,
    boardId,
    timestamp: new Date().toISOString(),
  });
}
