import Redis from "ioredis";
import { GlobalLogger } from "@cascade/logger";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL);

redis.on("connect", () => GlobalLogger.logger.info("Redis connected"));
redis.on("error", (err) => GlobalLogger.logger.error(err, "Redis error"));

const CACHE_TTL = 300; // 5 minutes

export async function getCachedBoards(userId: string): Promise<any[] | null> {
  try {
    const cached = await redis.get(`boards:${userId}`);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch (err) {
      GlobalLogger.logger.warn({ err }, "Redis cached boards JSON parse failed");
      return null;
    }
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis getCachedBoards failed (using DB)");
    return null;
  }
}

export async function setCachedBoards(userId: string, boards: any[]) {
  try {
    await redis.setex(`boards:${userId}`, CACHE_TTL, JSON.stringify(boards));
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis setCachedBoards failed (non-fatal)");
  }
}

export async function getCachedBoard(boardId: string): Promise<any | null> {
  try {
    const cached = await redis.get(`board:${boardId}`);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch (err) {
      GlobalLogger.logger.warn({ err }, "Redis cached board JSON parse failed");
      return null;
    }
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis getCachedBoard failed (using DB)");
    return null;
  }
}

export async function setCachedBoard(boardId: string, board: any) {
  try {
    await redis.setex(`board:${boardId}`, CACHE_TTL, JSON.stringify(board));
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis setCachedBoard failed (non-fatal)");
  }
}

export async function invalidateBoardCache(boardId: string, ownerId: string) {
  try {
    await redis.del(`board:${boardId}`);
    if (ownerId) {
      await redis.del(`boards:${ownerId}`);
    }
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis invalidateBoardCache failed (non-fatal)");
  }
}

export async function getCachedTasks(boardId: string): Promise<any[] | null> {
  try {
    const cached = await redis.get(`tasks:${boardId}`);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch (err) {
      GlobalLogger.logger.warn({ err }, "Redis cached tasks JSON parse failed");
      return null;
    }
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis getCachedTasks failed (using DB)");
    return null;
  }
}

export async function setCachedTasks(boardId: string, tasks: any[]) {
  try {
    await redis.setex(`tasks:${boardId}`, CACHE_TTL, JSON.stringify(tasks));
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis setCachedTasks failed (non-fatal)");
  }
}

export async function invalidateTaskCache(boardId: string) {
  try {
    await redis.del(`tasks:${boardId}`);
  } catch (err) {
    GlobalLogger.logger.warn({ err }, "Redis invalidateTaskCache failed (non-fatal)");
  }
}
