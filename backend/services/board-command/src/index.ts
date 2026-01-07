import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { pinoLogger, GlobalLogger } from "@cascade/logger";
import { Board, Task } from "./models";
import {
  initKafka,
  publishBoardCreated,
  publishBoardUpdated,
  publishBoardDeleted,
  publishTaskCreated,
  publishTaskMoved,
  publishTaskUpdated,
  publishTaskDeleted,
} from "./kafka";
import {
  CreateBoardSchema,
  UpdateBoardSchema,
  JoinBoardSchema,
  CreateColumnSchema,
  UpdateColumnSchema,
  CreateTagSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  ReorderTaskSchema,
  generatePin,
  generateId,
  BoardSchema,
  TaskSchema,
  ColumnSchema,
  TagSchema,
  ErrorSchema,
} from "./schemas";
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
  (c) => c.json({ status: "ok", service: "board-command-service" })
);

// OpenAPI Docs
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Board Command Service API",
  },
});

// ============ BOARD ENDPOINTS ============

// Create board
// Create board
app.openapi(
  createRoute({
    method: "post",
    path: "/api/boards",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateBoardSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Board created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              board: BoardSchema,
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
    },
  }),
  async (c) => {
    try {
      const validated = c.req.valid("json");

      const board = new Board({
        ...validated,
        joinPin: validated.visibility === "private" ? generatePin() : undefined,
        members: [{ userId: validated.ownerId, role: "owner" }],
      });
      await board.save();

      await publishBoardCreated(
        board._id.toString(),
        board.name,
        board.ownerId,
        board.visibility
      );

      return c.json({ success: true, board }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Update board
// Update board
app.openapi(
  createRoute({
    method: "put",
    path: "/api/boards/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateBoardSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Board updated",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              board: BoardSchema,
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
      404: {
        description: "Board not found",
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
      const validated = c.req.valid("json");

      const board = await Board.findById(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      if (validated.name) board.name = validated.name;
      if (validated.description !== undefined)
        board.description = validated.description;
      board.updatedAt = new Date();
      await board.save();

      await publishBoardUpdated(board._id.toString(), validated);

      return c.json({ success: true, board });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Delete board
// Delete board
app.openapi(
  createRoute({
    method: "delete",
    path: "/api/boards/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
    },
    responses: {
      200: {
        description: "Board deleted",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
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
      404: {
        description: "Board not found",
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

      const board = await Board.findByIdAndDelete(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      // Delete all tasks in the board
      await Task.deleteMany({ boardId: id });

      await publishBoardDeleted(id);

      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Join board
// Join board
app.openapi(
  createRoute({
    method: "post",
    path: "/api/boards/{id}/join",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: JoinBoardSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Joined board",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              board: BoardSchema,
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
      403: {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: ErrorSchema,
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
    },
  }),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const validated = c.req.valid("json");

      const board = await Board.findById(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      // Check if already a member
      const isMember = board.members.some(
        (m: any) => m.userId === validated.userId
      );
      if (isMember) {
        return c.json({ success: false, error: "Already a member" }, 400);
      }

      // Check PIN for private boards
      if (board.visibility === "private") {
        if (!validated.pin || validated.pin !== board.joinPin) {
          return c.json({ success: false, error: "Invalid PIN" }, 403);
        }
      }

      board.members.push({ userId: validated.userId, role: "member" });
      await board.save();

      await publishBoardUpdated(board._id.toString(), {
        members: board.members,
      });

      return c.json({ success: true, board });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Get public boards
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
      const boards = await Board.find({ visibility: "public" }).lean();
      return c.json({ success: true, boards });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 500);
    }
  }
);

// ============ COLUMN ENDPOINTS ============

// Add column
// Add column
app.openapi(
  createRoute({
    method: "post",
    path: "/api/boards/{id}/columns",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: CreateColumnSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Column added",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              column: ColumnSchema,
              board: BoardSchema,
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
      404: {
        description: "Board not found",
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
      const validated = c.req.valid("json");

      const board = await Board.findById(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      const newColumn = {
        id: generateId(),
        name: validated.name,
        order: board.columns.length,
        color: validated.color || "#64748b",
      };

      board.columns.push(newColumn);
      board.updatedAt = new Date();
      await board.save();

      await publishBoardUpdated(id, { columns: board.columns });

      return c.json({ success: true, column: newColumn, board });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Update column
// Update column
app.openapi(
  createRoute({
    method: "put",
    path: "/api/boards/{id}/columns/{colId}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
        colId: z.string().openapi({ param: { name: "colId", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateColumnSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Column updated",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              board: BoardSchema,
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
      404: {
        description: "Not found",
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
      const { id, colId } = c.req.valid("param");
      const validated = c.req.valid("json");

      const board = await Board.findById(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      const column = board.columns.find((col: any) => col.id === colId);
      if (!column) {
        return c.json({ success: false, error: "Column not found" }, 404);
      }

      if (validated.name) column.name = validated.name;
      if (validated.color) column.color = validated.color;
      if (validated.order !== undefined) column.order = validated.order;

      board.updatedAt = new Date();
      await board.save();

      await publishBoardUpdated(id, { columns: board.columns });

      return c.json({ success: true, board });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Delete column
// Delete column
app.openapi(
  createRoute({
    method: "delete",
    path: "/api/boards/{id}/columns/{colId}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
        colId: z.string().openapi({ param: { name: "colId", in: "path" } }),
      }),
    },
    responses: {
      200: {
        description: "Column deleted",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              board: BoardSchema,
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
      404: {
        description: "Not found",
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
      const { id, colId } = c.req.valid("param");

      const board = await Board.findById(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      if (board.columns.length <= 1) {
        return c.json(
          { success: false, error: "Cannot delete last column" },
          400
        );
      }

      board.columns.pull({ id: colId });

      // Move tasks from deleted column to first column
      const firstColumnId = board.columns[0].id;
      await Task.updateMany(
        { boardId: id, columnId: colId },
        { columnId: firstColumnId }
      );

      board.updatedAt = new Date();
      await board.save();

      await publishBoardUpdated(id, { columns: board.columns });

      return c.json({ success: true, board });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// ============ TAG ENDPOINTS ============

// Add tag to board
// Add tag to board
app.openapi(
  createRoute({
    method: "post",
    path: "/api/boards/{id}/tags",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: CreateTagSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Tag added",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              tag: TagSchema,
              board: BoardSchema,
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
      404: {
        description: "Board not found",
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
      const validated = c.req.valid("json");

      const board = await Board.findById(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      const newTag = {
        id: generateId(),
        name: validated.name,
        color: validated.color || "#3b82f6",
      };

      board.tags.push(newTag);
      board.updatedAt = new Date();
      await board.save();

      return c.json({ success: true, tag: newTag, board });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Delete tag
// Delete tag
app.openapi(
  createRoute({
    method: "delete",
    path: "/api/boards/{id}/tags/{tagId}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
        tagId: z.string().openapi({ param: { name: "tagId", in: "path" } }),
      }),
    },
    responses: {
      200: {
        description: "Tag deleted",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              board: BoardSchema,
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
      404: {
        description: "Board not found",
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
      const { id, tagId } = c.req.valid("param");

      const board = await Board.findById(id);
      if (!board) {
        return c.json({ success: false, error: "Board not found" }, 404);
      }

      board.tags.pull({ id: tagId });

      // Remove tag from all tasks
      await Task.updateMany({ boardId: id }, { $pull: { tags: tagId } });

      board.updatedAt = new Date();
      await board.save();

      return c.json({ success: true, board });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// ============ TASK ENDPOINTS ============

// Create task
// Create task
app.openapi(
  createRoute({
    method: "post",
    path: "/api/tasks",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateTaskSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Task created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              task: TaskSchema,
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
    },
  }),
  async (c) => {
    try {
      const validated = c.req.valid("json");

      // Get max order in column
      const maxOrderTask = await Task.findOne({
        boardId: validated.boardId,
        columnId: validated.columnId,
      }).sort({ order: -1 });

      const task = new Task({
        ...validated,
        order: maxOrderTask ? maxOrderTask.order + 1 : 0,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
      });
      await task.save();

      await publishTaskCreated(
        task._id.toString(),
        task.boardId.toString(),
        task.title,
        task.columnId
      );

      return c.json({ success: true, task }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Update task
// Update task
app.openapi(
  createRoute({
    method: "put",
    path: "/api/tasks/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateTaskSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Task updated",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              task: TaskSchema,
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
      404: {
        description: "Task not found",
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
      const validated = c.req.valid("json");

      const task = await Task.findById(id);
      if (!task) {
        return c.json({ success: false, error: "Task not found" }, 404);
      }

      const updates: any = {};
      if (validated.title !== undefined) {
        task.title = validated.title;
        updates.title = validated.title;
      }
      if (validated.description !== undefined) {
        task.description = validated.description;
        updates.description = validated.description;
      }
      if (validated.columnId !== undefined) {
        task.columnId = validated.columnId;
        updates.columnId = validated.columnId;
      }
      if (validated.assignedTo !== undefined) {
        task.assignedTo = validated.assignedTo;
        updates.assignedTo = validated.assignedTo;
      }
      if (validated.tags !== undefined) {
        task.tags = validated.tags;
        updates.tags = validated.tags;
      }
      if (validated.priority !== undefined) {
        task.priority = validated.priority;
        updates.priority = validated.priority;
      }
      if (validated.dueDate !== undefined) {
        task.dueDate = validated.dueDate
          ? new Date(validated.dueDate)
          : undefined;
        updates.dueDate = validated.dueDate;
      }
      if (validated.order !== undefined) {
        task.order = validated.order;
        updates.order = validated.order;
      }

      task.updatedAt = new Date();
      await task.save();

      await publishTaskUpdated(
        task._id.toString(),
        task.boardId.toString(),
        updates
      );

      return c.json({ success: true, task });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Delete task
// Delete task
app.openapi(
  createRoute({
    method: "delete",
    path: "/api/tasks/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
    },
    responses: {
      200: {
        description: "Task deleted",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
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
      404: {
        description: "Task not found",
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

      const task = await Task.findByIdAndDelete(id);
      if (!task) {
        return c.json({ success: false, error: "Task not found" }, 404);
      }

      await publishTaskDeleted(id, task.boardId.toString());

      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Move task (change column + order)
// Move task (change column + order)
app.openapi(
  createRoute({
    method: "patch",
    path: "/api/tasks/{id}/move",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: MoveTaskSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Task moved",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              task: TaskSchema,
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
      404: {
        description: "Task not found",
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
      const validated = c.req.valid("json");

      const task = await Task.findById(id);
      if (!task) {
        return c.json({ success: false, error: "Task not found" }, 404);
      }

      const oldColumnId = task.columnId;
      task.columnId = validated.columnId;
      if (validated.order !== undefined) {
        task.order = validated.order;
      }
      task.updatedAt = new Date();
      await task.save();

      await publishTaskMoved(
        task._id.toString(),
        task.boardId.toString(),
        oldColumnId,
        task.columnId
      );

      return c.json({ success: true, task });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Reorder tasks (for drag-drop)
// Reorder tasks (for drag-drop)
app.openapi(
  createRoute({
    method: "patch",
    path: "/api/tasks/{id}/reorder",
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: "id", in: "path" } }),
      }),
      body: {
        content: {
          "application/json": {
            schema: ReorderTaskSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Task reordered",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              task: TaskSchema,
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
      404: {
        description: "Task not found",
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
      const validated = c.req.valid("json");

      const task = await Task.findById(id);
      if (!task) {
        return c.json({ success: false, error: "Task not found" }, 404);
      }

      const oldColumnId = task.columnId;
      task.columnId = validated.columnId;
      task.order = validated.order;
      task.updatedAt = new Date();
      await task.save();

      await publishTaskMoved(
        task._id.toString(),
        task.boardId.toString(),
        oldColumnId,
        task.columnId
      );

      return c.json({ success: true, task });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 400);
    }
  }
);

// Initialize Kafka
await initKafka();

GlobalLogger.logger.info(
  `Board Command Service starting on port ${process.env.PORT || 3002}`
);

export default {
  port: process.env.PORT || 3002,
  fetch: app.fetch,
};
