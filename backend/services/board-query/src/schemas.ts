import { z } from "@hono/zod-openapi";

export const ColumnSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    order: z.number().default(0),
    color: z.string().default("#64748b"),
  })
  .openapi("Column");

export const MemberSchema = z
  .object({
    userId: z.string(),
    role: z.enum(["owner", "member"]).default("member"),
    joinedAt: z.string().optional(), // Date as string in JSON
  })
  .openapi("Member");

export const TagSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string().default("#3b82f6"),
  })
  .openapi("Tag");

export const BoardSchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    ownerId: z.string(),
    visibility: z.enum(["public", "private"]).default("private"),
    joinPin: z.string().optional(),
    members: z.array(MemberSchema),
    columns: z.array(ColumnSchema),
    tags: z.array(TagSchema),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .openapi("Board");

export const TaskSchema = z
  .object({
    _id: z.string(),
    boardId: z.string(),
    columnId: z.string().default("todo"),
    title: z.string(),
    description: z.string().optional(),
    assignedTo: z.string().optional(),
    tags: z.array(z.string()),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().optional(),
    order: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .openapi("Task");

export const ErrorSchema = z
  .object({
    success: z.boolean(),
    error: z.string(),
  })
  .openapi("Error");
