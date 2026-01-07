import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { pinoLogger, GlobalLogger } from "@cascade/logger";
import { Board, Task } from "./models";
import {
  getCachedBoards,
  setCachedBoards,
  getCachedBoard,
  setCachedBoard,
  getCachedTasks,
  setCachedTasks,
} from "./cache";
import { initKafka } from "./kafka";
import "dotenv/config";

export const app = new OpenAPIHono();

// Middleware
app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
  })
);
app.use(pinoLogger());

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", service: "board-query-service" })
);

// OpenAPI Docs
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Board Query Service API",
  },
});

// Get all boards for a user (owner or member)
app.get("/api/boards", async (c) => {
  try {
    const userId = c.req.query("ownerId"); // Keep param name for backward compat
    if (!userId) {
      return c.json(
        { success: false, error: "ownerId query parameter required" },
        400
      );
    }

    // Try cache first
    let boards = await getCachedBoards(userId);

    if (!boards) {
      // Cache miss - fetch boards where user is owner OR a member
      boards = await Board.find({
        $or: [{ ownerId: userId }, { "members.userId": userId }],
      }).lean();
      await setCachedBoards(userId, boards);
    }

    return c.json({ success: true, boards });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get public boards
app.get("/api/boards/public", async (c) => {
  try {
    const boards = await Board.find({ visibility: "public" })
      .sort({ createdAt: -1 })
      .lean();

    return c.json({ success: true, boards });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single board
app.get("/api/boards/:id", async (c) => {
  try {
    const boardId = c.req.param("id");

    // Try cache first
    let board = await getCachedBoard(boardId);

    if (!board) {
      // Cache miss - fetch from DB
      board = await Board.findById(boardId).lean();
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }
      await setCachedBoard(boardId, board);
    }

    return c.json({ success: true, board });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all tasks for a board
app.get("/api/boards/:id/tasks", async (c) => {
  try {
    const boardId = c.req.param("id");

    // Try cache first
    let tasks = await getCachedTasks(boardId);

    if (!tasks) {
      // Cache miss - fetch from DB
      tasks = await Task.find({ boardId })
        .sort({ order: 1, createdAt: 1 })
        .lean();
      await setCachedTasks(boardId, tasks);
    }

    return c.json({ success: true, tasks });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single task
app.get("/api/tasks/:id", async (c) => {
  try {
    const taskId = c.req.param("id");
    const task = await Task.findById(taskId).lean();

    if (!task) {
      return c.json({ success: false, error: "Task not found" }, 404);
    }

    return c.json({ success: true, task });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Initialize Kafka consumer
initKafka().catch(console.error);

GlobalLogger.logger.info(
  `Board Query Service starting on port ${process.env.PORT || 3003}`
);

export default {
  port: process.env.PORT || 3003,
  fetch: app.fetch,
};
