import Redis from "ioredis";
import { GlobalLogger } from "@cascade/logger";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL);

redis.on("connect", () => GlobalLogger.logger.info("Redis connected"));
redis.on("error", (err) => GlobalLogger.logger.error(err, "Redis error"));

const CACHE_TTL = 300; // 5 minutes

export async function getCachedBoards(userId: string): Promise<any[] | null> {
  const cached = await redis.get(`boards:${userId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedBoards(userId: string, boards: any[]) {
  await redis.setex(`boards:${userId}`, CACHE_TTL, JSON.stringify(boards));
}

export async function getCachedBoard(boardId: string): Promise<any | null> {
  const cached = await redis.get(`board:${boardId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedBoard(boardId: string, board: any) {
  await redis.setex(`board:${boardId}`, CACHE_TTL, JSON.stringify(board));
}

export async function invalidateBoardCache(boardId: string, ownerId: string) {
  await redis.del(`board:${boardId}`);
  await redis.del(`boards:${ownerId}`);
}

export async function getCachedTasks(boardId: string): Promise<any[] | null> {
  const cached = await redis.get(`tasks:${boardId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedTasks(boardId: string, tasks: any[]) {
  await redis.setex(`tasks:${boardId}`, CACHE_TTL, JSON.stringify(tasks));
}

export async function invalidateTaskCache(boardId: string) {
  await redis.del(`tasks:${boardId}`);
}
