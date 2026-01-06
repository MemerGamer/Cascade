import { KafkaClient, type EachMessagePayload } from "@cascade/kafka";
import { Board, Task } from "./models";
import { invalidateBoardCache, invalidateTaskCache } from "./cache";
import "dotenv/config";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(
  ","
);

export const kafkaClient = new KafkaClient(
  "board-query-service",
  KAFKA_BROKERS
);

const TOPICS = [
  "board.created",
  "board.updated",
  "board.deleted",
  "task.created",
  "task.moved",
  "task.updated",
  "task.deleted",
];

export async function initKafka() {
  await kafkaClient.connectConsumer("board-query-group", TOPICS, false);
  await kafkaClient.consume(handleEvent);
  console.log("Kafka consumer started");
}

async function handleEvent(payload: EachMessagePayload) {
  const { topic, message } = payload;
  const event = JSON.parse(message.value?.toString() || "{}");

  console.log(`Processing event: ${topic}`, event);

  try {
    switch (topic) {
      case "board.created":
        await handleBoardCreated(event);
        break;
      case "board.updated":
        await handleBoardUpdated(event);
        break;
      case "board.deleted":
        await handleBoardDeleted(event);
        break;
      case "task.created":
        await handleTaskCreated(event);
        break;
      case "task.moved":
        await handleTaskMoved(event);
        break;
      case "task.updated":
        await handleTaskUpdated(event);
        break;
      case "task.deleted":
        await handleTaskDeleted(event);
        break;
    }
  } catch (error) {
    console.error(`Error handling ${topic}:`, error);
  }
}

async function handleBoardCreated(event: any) {
  // Invalidate cache for owner's boards list
  await invalidateBoardCache(event.boardId, event.ownerId);
}

async function handleBoardUpdated(event: any) {
  // Invalidate board cache
  const board = await Board.findById(event.boardId);
  if (board) {
    await invalidateBoardCache(event.boardId, board.ownerId);
    // Also invalidate for all members
    if (board.members && board.members.length > 0) {
      for (const member of board.members) {
        await invalidateBoardCache(event.boardId, member.userId);
      }
    }
  }
}

async function handleBoardDeleted(event: any) {
  // Board already deleted in command service, just invalidate cache
  await invalidateBoardCache(event.boardId, "");
}

async function handleTaskCreated(event: any) {
  await invalidateTaskCache(event.boardId);
}

async function handleTaskMoved(event: any) {
  await invalidateTaskCache(event.boardId);
}

async function handleTaskUpdated(event: any) {
  await invalidateTaskCache(event.boardId);
}

async function handleTaskDeleted(event: any) {
  await invalidateTaskCache(event.boardId);
}
