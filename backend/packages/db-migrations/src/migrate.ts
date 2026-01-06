import { connectDB, disconnectDB, ensureIndexes } from "./connection";
import "dotenv/config";

async function migrate() {
  // Note: auth-db is managed by Better-Auth automatically
  const databases = [
    {
      name: "board-db",
      uri:
        process.env.BOARD_MONGODB_URI || "mongodb://localhost:27017/board-db",
    },
    {
      name: "audit-db",
      uri:
        process.env.AUDIT_MONGODB_URI || "mongodb://localhost:27017/audit-db",
    },
  ];

  for (const db of databases) {
    console.log(`\n=== Migrating ${db.name} ===`);
    try {
      const connection = await connectDB(db.uri);
      await ensureIndexes(connection);
      await disconnectDB();
      console.log(`✓ ${db.name} migration complete`);
    } catch (error) {
      console.error(`✗ ${db.name} migration failed:`, error);
      process.exit(1);
    }
  }

  console.log("\n✓ All migrations complete");
}

migrate();
