import mongoose from "mongoose";
import "dotenv/config";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/board-db";

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB:", MONGODB_URI);

// Column schema for custom columns
const ColumnSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  color: { type: String, default: "#64748b" },
});

// Member schema for board members
const MemberSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  role: { type: String, enum: ["owner", "member"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
});

// Tag schema for task tags
const TagSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  color: { type: String, default: "#3b82f6" },
});

const BoardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  ownerId: { type: String, required: true },
  visibility: { type: String, enum: ["public", "private"], default: "private" },
  joinPin: { type: String }, // 6-digit PIN for private boards
  members: [MemberSchema],
  columns: {
    type: [ColumnSchema],
    default: [
      { id: "todo", name: "To Do", order: 0, color: "#64748b" },
      { id: "in-progress", name: "In Progress", order: 1, color: "#3b82f6" },
      { id: "done", name: "Done", order: 2, color: "#22c55e" },
    ],
  },
  tags: [TagSchema], // Board-level custom tags
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const TaskSchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
  },
  columnId: { type: String, default: "todo" },
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: { type: String },
  tags: [{ type: String }], // Array of tag IDs
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  dueDate: { type: Date },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// For backward compatibility, add virtual for status
TaskSchema.virtual("status").get(function () {
  return this.columnId;
});

export const Board = mongoose.model("Board", BoardSchema);
export const Task = mongoose.model("Task", TaskSchema);
