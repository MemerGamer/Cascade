import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { pinoLogger, GlobalLogger } from "@cascade/logger";
import { Board, Task } from "./models";
import { BoardSchema, TaskSchema, ErrorSchema } from "./schemas";
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

// Helper to serialize Mongoose documents to match Zod schemas
type BoardType = z.infer<typeof BoardSchema>;
type TaskType = z.infer<typeof TaskSchema>;

function serializeBoard(board: any): BoardType {
  return {
    _id: board._id.toString(),
    name: board.name,
    description: board.description ?? undefined,
    ownerId: board.ownerId,
    visibility: board.visibility,
    joinPin: board.joinPin ?? undefined,
    members: board.members.map((m: any) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : undefined,
    })),
    columns: board.columns.map((c: any) => ({
      id: c.id,
      name: c.name,
      order: c.order ?? 0,
      color: c.color ?? "#64748b",
    })),
    tags: board.tags.map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color ?? "#3b82f6",
    })),
    createdAt: board.createdAt ? new Date(board.createdAt).toISOString() : undefined,
    updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : undefined,
  };
}

function serializeTask(task: any): TaskType {
  return {
    _id: task._id.toString(),
    boardId: task.boardId?.toString() ?? task.boardId,
    columnId: task.columnId,
    title: task.title,
    description: task.description ?? undefined,
    assignedTo: task.assignedTo ?? undefined,
    tags: task.tags ?? [],
    priority: task.priority ?? undefined,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
    order: task.order ?? undefined,
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : undefined,
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : undefined,
  };
}

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
app.openapi(
  createRoute({
    method: "get",
    path: "/health",
    responses: {
      200: {
        description: "Health check",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string(),
              service: z.string(),
            }),
          },
        },
      },
    },
  }),
  (c) => c.json({ status: "ok", service: "board-query-service" })
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
app.openapi(
  createRoute({
    method: "get",
    path: "/api/boards",
    request: {
      query: z.object({
        ownerId: z
          .string()
          .openapi({ param: { name: "ownerId", in: "query" } }),
      }),
    },
    responses: {
      200: {
        description: "List of boards",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              boards: z.array(BoardSchema),
            }),
          },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      const { ownerId } = c.req.valid("query");

      // Try cache first
      let boards = await getCachedBoards(ownerId);

      if (!boards) {
        // Cache miss - fetch boards where user is owner OR a member
        boards = await Board.find({
          $or: [{ ownerId: ownerId }, { "members.userId": ownerId }],
        }).lean();
        await setCachedBoards(ownerId, boards);
      }

      const serializedBoards = boards.map(serializeBoard);
      return c.json({ success: true, boards: serializedBoards } as const, 200);
    } catch (error: any) {
      return c.json({ success: false, error: error.message } as const, 500);
    }
  }
);

// Get public boards
app.openapi(
  createRoute({
    method: "get",
    path: "/api/boards/public",
    responses: {
      200: {
        description: "List of public boards",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              boards: z.array(BoardSchema),
            }),
          },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      const boards = await Board.find({ visibility: "public" })
        .sort({ createdAt: -1 })
        .lean();

      const serializedBoards = boards.map(serializeBoard);
      return c.json({ success: true, boards: serializedBoards } as const, 200);
    } catch (error: any) {
      return c.json({ success: false, error: error.message } as const, 500);
    }
  }
);

// Get single board
app.openapi(
  createRoute({
    method: "get",
    path: "/api/boards/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
    },
    responses: {
      200: {
        description: "Board details",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              board: BoardSchema,
            }),
          },
        },
      },
      404: {
        description: "Board not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      const { id } = c.req.valid("param");

      // Try cache first
      let board = await getCachedBoard(id);

      if (!board) {
        // Cache miss - fetch from DB
        board = await Board.findById(id).lean();
        if (!board) {
          return c.json({ success: false, error: "Board not found" } as const, 404);
        }
        await setCachedBoard(id, board);
      }

      const serializedBoard = serializeBoard(board);
      return c.json({ success: true, board: serializedBoard } as const, 200);
    } catch (error: any) {
      return c.json({ success: false, error: error.message } as const, 500);
    }
  }
);

// Get all tasks for a board
app.openapi(
  createRoute({
    method: "get",
    path: "/api/boards/{id}/tasks",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
    },
    responses: {
      200: {
        description: "List of tasks",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              tasks: z.array(TaskSchema),
            }),
          },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      const { id } = c.req.valid("param");

      // Try cache first
      let tasks = await getCachedTasks(id);

      if (!tasks) {
        // Cache miss - fetch from DB
        tasks = await Task.find({ boardId: id })
          .sort({ order: 1, createdAt: 1 })
          .lean();
        await setCachedTasks(id, tasks);
      }

      const serializedTasks = tasks.map(serializeTask);
      return c.json({ success: true, tasks: serializedTasks }, 200) as any;
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 500) as any;
    }
  }
);

// Get single task
app.openapi(
  createRoute({
    method: "get",
    path: "/api/tasks/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
    },
    responses: {
      200: {
        description: "Task details",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              task: TaskSchema,
            }),
          },
        },
      },
      404: {
        description: "Task not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const task = await Task.findById(id).lean();

      if (!task) {
        return c.json({ success: false, error: "Task not found" }, 404) as any;
      }

      const serializedTask = serializeTask(task);
      return c.json({ success: true, task: serializedTask }, 200) as any;
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 500) as any;
    }
  }
);

// Initialize Kafka consumer
initKafka().catch(console.error);

GlobalLogger.logger.info(
  `Board Query Service starting on port ${process.env.PORT || 3003}`
);

export default {
  port: process.env.PORT || 3003,
  fetch: app.fetch,
};
