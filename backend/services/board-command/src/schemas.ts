import { z } from "zod";

// Helper for generating random PIN
export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper for generating column/tag IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Board schemas
export const CreateBoardSchema = z.object({
  name: z.string().min(1, "Board name is required"),
  description: z.string().optional(),
  ownerId: z.string().min(1, "Owner ID is required"),
  visibility: z.enum(["public", "private"]).default("private"),
});

export const UpdateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const JoinBoardSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  pin: z.string().optional(), // Required for private boards
});

// Column schemas
export const CreateColumnSchema = z.object({
  name: z.string().min(1, "Column name is required"),
  color: z.string().optional(),
});

export const UpdateColumnSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  order: z.number().optional(),
});

// Tag schemas
export const CreateTagSchema = z.object({
  name: z.string().min(1, "Tag name is required"),
  color: z.string().optional(),
});

// Task schemas
export const CreateTaskSchema = z.object({
  boardId: z.string().min(1, "Board ID is required"),
  columnId: z.string().default("todo"),
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  columnId: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().nullable().optional(),
  order: z.number().optional(),
});

export const MoveTaskSchema = z.object({
  columnId: z.string().min(1, "Column ID is required"),
  order: z.number().optional(),
});

export const ReorderTaskSchema = z.object({
  columnId: z.string().min(1),
  order: z.number().min(0),
});

// Type exports
export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
export type UpdateBoardInput = z.infer<typeof UpdateBoardSchema>;
export type JoinBoardInput = z.infer<typeof JoinBoardSchema>;
export type CreateColumnInput = z.infer<typeof CreateColumnSchema>;
export type UpdateColumnInput = z.infer<typeof UpdateColumnSchema>;
export type CreateTagInput = z.infer<typeof CreateTagSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;
export type ReorderTaskInput = z.infer<typeof ReorderTaskSchema>;
