import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";

async function checkDatabase() {
  console.log("Connecting to database and fetching tasks...");
  try {
    const tasks = await db.select().from(tasksTable);
    console.log(`\nFound ${tasks.length} tasks in the database:\n`);
    
    if (tasks.length === 0) {
      console.log("No tasks found in the database. Enter some data on the frontend or check your connection.");
    } else {
      console.table(
        tasks.map(t => ({
          ID: t.id,
          Title: t.title,
          Status: t.status,
          Priority: t.priority,
          Category: t.category,
          "Scheduled Date": t.scheduledDate || "N/A",
          Created: t.createdAt ? new Date(t.createdAt).toLocaleString() : "N/A",
        }))
      );
    }
  } catch (error) {
    console.error("Failed to query the database:", error);
  } finally {
    process.exit(0);
  }
}

checkDatabase();
