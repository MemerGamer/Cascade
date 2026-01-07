import mongoose from "mongoose";
import { GlobalLogger } from "@cascade/logger";
import "dotenv/config";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/audit-db";

await mongoose.connect(MONGODB_URI);
GlobalLogger.logger.info(`Connected to MongoDB (audit): ${MONGODB_URI}`);

const AuditEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  eventData: { type: mongoose.Schema.Types.Mixed, required: true },
  userId: { type: String, index: true },
  timestamp: { type: Date, default: Date.now, required: true, index: true },
});

// Immutable - never update or delete
export const AuditEvent = mongoose.model("AuditEvent", AuditEventSchema);
