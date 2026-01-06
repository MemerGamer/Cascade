import mongoose from "mongoose";
import "dotenv/config";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/board-db";

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB (read-only):", MONGODB_URI);

// Read models - same schema structure as command service (for queries)
const ColumnSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  color: { type: String, default: "#64748b" },
});

const MemberSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  role: { type: String, enum: ["owner", "member"], default: "member" },
  joinedAt: { type: Date },
});

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
  joinPin: { type: String },
  members: [MemberSchema],
  columns: [ColumnSchema],
  tags: [TagSchema],
  createdAt: { type: Date },
  updatedAt: { type: Date },
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
  tags: [{ type: String }],
  priority: { type: String, enum: ["low", "medium", "high"] },
  dueDate: { type: Date },
  order: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

export const Board = mongoose.model("Board", BoardSchema);
export const Task = mongoose.model("Task", TaskSchema);
