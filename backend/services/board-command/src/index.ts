import { Hono } from "hono";
import { cors } from "hono/cors";
import { pinoLogger } from "@cascade/logger";
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
} from "./schemas";
import "dotenv/config";

const app = new Hono();

// Middleware
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(pinoLogger());

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", service: "board-command-service" })
);

// ============ BOARD ENDPOINTS ============

// Create board
app.post("/api/boards", async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateBoardSchema.parse(body);

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
});

// Update board
app.put("/api/boards/:id", async (c) => {
  try {
    const boardId = c.req.param("id");
    const body = await c.req.json();
    const validated = UpdateBoardSchema.parse(body);

    const board = await Board.findById(boardId);
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
});

// Delete board
app.delete("/api/boards/:id", async (c) => {
  try {
    const boardId = c.req.param("id");

    const board = await Board.findByIdAndDelete(boardId);
    if (!board) {
      return c.json({ success: false, error: "Board not found" }, 404);
    }

    // Delete all tasks in the board
    await Task.deleteMany({ boardId });

    await publishBoardDeleted(boardId);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Join board
app.post("/api/boards/:id/join", async (c) => {
  try {
    const boardId = c.req.param("id");
    const body = await c.req.json();
    const validated = JoinBoardSchema.parse(body);

    const board = await Board.findById(boardId);
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

    await publishBoardUpdated(board._id.toString(), { members: board.members });

    return c.json({ success: true, board });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Get public boards
app.get("/api/boards/public", async (c) => {
  try {
    const boards = await Board.find({ visibility: "public" }).lean();
    return c.json({ success: true, boards });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============ COLUMN ENDPOINTS ============

// Add column
app.post("/api/boards/:id/columns", async (c) => {
  try {
    const boardId = c.req.param("id");
    const body = await c.req.json();
    const validated = CreateColumnSchema.parse(body);

    const board = await Board.findById(boardId);
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

    await publishBoardUpdated(boardId, { columns: board.columns });

    return c.json({ success: true, column: newColumn, board });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Update column
app.put("/api/boards/:id/columns/:colId", async (c) => {
  try {
    const boardId = c.req.param("id");
    const colId = c.req.param("colId");
    const body = await c.req.json();
    const validated = UpdateColumnSchema.parse(body);

    const board = await Board.findById(boardId);
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

    await publishBoardUpdated(boardId, { columns: board.columns });

    return c.json({ success: true, board });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Delete column
app.delete("/api/boards/:id/columns/:colId", async (c) => {
  try {
    const boardId = c.req.param("id");
    const colId = c.req.param("colId");

    const board = await Board.findById(boardId);
    if (!board) {
      return c.json({ success: false, error: "Board not found" }, 404);
    }

    if (board.columns.length <= 1) {
      return c.json(
        { success: false, error: "Cannot delete last column" },
        400
      );
    }

    board.columns = board.columns.filter((col: any) => col.id !== colId);

    // Move tasks from deleted column to first column
    const firstColumnId = board.columns[0].id;
    await Task.updateMany(
      { boardId, columnId: colId },
      { columnId: firstColumnId }
    );

    board.updatedAt = new Date();
    await board.save();

    await publishBoardUpdated(boardId, { columns: board.columns });

    return c.json({ success: true, board });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// ============ TAG ENDPOINTS ============

// Add tag to board
app.post("/api/boards/:id/tags", async (c) => {
  try {
    const boardId = c.req.param("id");
    const body = await c.req.json();
    const validated = CreateTagSchema.parse(body);

    const board = await Board.findById(boardId);
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
});

// Delete tag
app.delete("/api/boards/:id/tags/:tagId", async (c) => {
  try {
    const boardId = c.req.param("id");
    const tagId = c.req.param("tagId");

    const board = await Board.findById(boardId);
    if (!board) {
      return c.json({ success: false, error: "Board not found" }, 404);
    }

    board.tags = board.tags.filter((tag: any) => tag.id !== tagId);

    // Remove tag from all tasks
    await Task.updateMany({ boardId }, { $pull: { tags: tagId } });

    board.updatedAt = new Date();
    await board.save();

    return c.json({ success: true, board });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// ============ TASK ENDPOINTS ============

// Create task
app.post("/api/tasks", async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateTaskSchema.parse(body);

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
});

// Update task
app.put("/api/tasks/:id", async (c) => {
  try {
    const taskId = c.req.param("id");
    const body = await c.req.json();
    const validated = UpdateTaskSchema.parse(body);

    const task = await Task.findById(taskId);
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
});

// Delete task
app.delete("/api/tasks/:id", async (c) => {
  try {
    const taskId = c.req.param("id");

    const task = await Task.findByIdAndDelete(taskId);
    if (!task) {
      return c.json({ success: false, error: "Task not found" }, 404);
    }

    await publishTaskDeleted(taskId, task.boardId.toString());

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Move task (change column + order)
app.patch("/api/tasks/:id/move", async (c) => {
  try {
    const taskId = c.req.param("id");
    const body = await c.req.json();
    const validated = MoveTaskSchema.parse(body);

    const task = await Task.findById(taskId);
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
});

// Reorder tasks (for drag-drop)
app.patch("/api/tasks/:id/reorder", async (c) => {
  try {
    const taskId = c.req.param("id");
    const body = await c.req.json();
    const validated = ReorderTaskSchema.parse(body);

    const task = await Task.findById(taskId);
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
});

// Initialize Kafka
await initKafka();

console.log(
  `Board Command Service starting on port ${process.env.PORT || 3002}`
);

export default {
  port: process.env.PORT || 3002,
  fetch: app.fetch,
};
