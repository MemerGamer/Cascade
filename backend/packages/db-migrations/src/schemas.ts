import mongoose from "mongoose";

// Board DB Schemas
const BoardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const TaskSchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ["todo", "in-progress", "done"],
    default: "todo",
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Audit DB Schema
const AuditEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  eventData: { type: mongoose.Schema.Types.Mixed, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId },
  timestamp: { type: Date, default: Date.now, required: true },
});

// Export models factory
export function createModels(connection: mongoose.Connection) {
  return {
    Board: connection.model("Board", BoardSchema),
    Task: connection.model("Task", TaskSchema),
    AuditEvent: connection.model("AuditEvent", AuditEventSchema),
  };
}

export { BoardSchema, TaskSchema, AuditEventSchema };
