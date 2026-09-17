import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { db } from "@workspace/db";
import { usersTable, userProfilesTable, tasksTable, chatMessagesTable, moodHistoryTable } from "@workspace/db/schema";
import crypto from "crypto";
import fs from "fs";
import { eq } from "drizzle-orm";

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha256")
    .toString("hex");
  return { hash, salt };
}

async function runMigration() {
  console.log("--------------------------------------------------");
  console.log("Concord Local Storage to PostgreSQL Migrator");
  console.log("--------------------------------------------------");

  let filePath = "";
  const pathsToTry = [
    path.resolve(process.cwd(), "localStorageExport.json"),
    path.resolve(process.cwd(), "../localStorageExport.json"),
    path.resolve(process.cwd(), "../../localStorageExport.json"),
  ];

  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.error("Error: Could not find 'localStorageExport.json' in any of the expected paths:");
    pathsToTry.forEach(p => console.error(`  - ${p}`));
    console.error("\nPlease copy the JSON export of your localStorage from the browser, save it as 'localStorageExport.json' in the project root directory, and run this command again.");
    process.exit(1);
  }

  console.log(`Loading local storage data from: ${filePath}`);

  try {
    const rawData = fs.readFileSync(filePath, "utf-8");
    const storage = JSON.parse(rawData);

    // 1. Process Users
    const usersDbStr = storage["concord_registered_users_db"];
    let defaultUserId = "usr_sharvibhavsar12";
    
    if (storage["concord_persistent_user_session"]) {
      const session = JSON.parse(storage["concord_persistent_user_session"]);
      if (session.id) defaultUserId = session.id;
    }

    if (!usersDbStr) {
      console.warn("Warning: Key 'concord_registered_users_db' not found in exported file. No users will be migrated.");
    } else {
      const usersDb = JSON.parse(usersDbStr);
      console.log(`Found ${Object.keys(usersDb).length} user account(s) to migrate...`);

      for (const [email, userObj] of Object.entries<any>(usersDb)) {
        console.log(`Migrating user: ${email}...`);
        
        // Hash password if plain text is present
        let passwordHash = userObj.passwordHash || null;
        let passwordSalt = userObj.passwordSalt || null;
        if (userObj.password && !passwordHash) {
          const hashed = hashPassword(userObj.password);
          passwordHash = hashed.hash;
          passwordSalt = hashed.salt;
        }

        const userId = userObj.id || `usr_${Date.now()}`;

        // Upsert into usersTable
        const existingUsers = await db.select().from(usersTable).where(eq(usersTable.email, email));
        if (existingUsers.length > 0) {
          await db.update(usersTable)
            .set({
              firstName: userObj.firstName || null,
              lastName: userObj.lastName || null,
              birthdate: userObj.birthdate || null,
              country: userObj.country || null,
              timezone: userObj.timezone || null,
              passwordHash,
              passwordSalt,
              authProvider: userObj.authProvider || "email",
              emailVerified: userObj.isEmailVerified !== undefined ? userObj.isEmailVerified : true,
              updatedAt: new Date(),
            })
            .where(eq(usersTable.email, email));
          console.log(`Updated existing user account: ${email}`);
        } else {
          await db.insert(usersTable).values({
            id: userId,
            email: email,
            firstName: userObj.firstName || null,
            lastName: userObj.lastName || null,
            birthdate: userObj.birthdate || null,
            country: userObj.country || null,
            timezone: userObj.timezone || null,
            passwordHash,
            passwordSalt,
            authProvider: userObj.authProvider || "email",
            emailVerified: userObj.isEmailVerified !== undefined ? userObj.isEmailVerified : true,
          });
          console.log(`Created new user account: ${email}`);
        }

        // Migrate User Profile if present
        let userProfile = null;
        if (storage["concord_local_profile"]) {
          const parsedProf = JSON.parse(storage["concord_local_profile"]);
          if (parsedProf.userId === userId || email === "sharvibhavsar12@gmail.com") {
            userProfile = parsedProf;
          }
        }

        if (userProfile) {
          console.log(`Migrating profile for user: ${email}...`);
          const existingProfiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
          
          const profileValues = {
            userId,
            displayName: userProfile.displayName || `${userObj.firstName || ""} ${userObj.lastName || ""}`.trim() || null,
            gender: userProfile.gender || null,
            lastPeriodDate: userProfile.lastPeriodDate ? new Date(userProfile.lastPeriodDate) : null,
            cycleLength: userProfile.cycleLength !== undefined ? Number(userProfile.cycleLength) : 28,
            lutealPhaseLength: userProfile.lutealPhaseLength !== undefined ? Number(userProfile.lutealPhaseLength) : 14,
            lastPeriodUpdatedAt: userProfile.lastPeriodUpdatedAt ? new Date(userProfile.lastPeriodUpdatedAt) : null,
            profileCompleted: userProfile.profileCompleted !== undefined ? Boolean(userProfile.profileCompleted) : false,
            weekendAvailable: userProfile.weekendAvailable !== undefined ? Boolean(userProfile.weekendAvailable) : false,
            productiveTimeStart: userProfile.productiveTimeStart || "09:00",
            productiveTimeEnd: userProfile.productiveTimeEnd || "17:00",
            priorityOrder: userProfile.priorityOrder || [],
            themePreference: userProfile.themePreference || "light",
            analyticsTheme: userProfile.analyticsTheme || "cool",
            customThemeColors: userProfile.customThemeColors || null,
            updatedAt: new Date(),
          };

          if (existingProfiles.length > 0) {
            await db.update(userProfilesTable)
              .set(profileValues)
              .where(eq(userProfilesTable.userId, userId));
            console.log(`Updated profile for ${email}`);
          } else {
            await db.insert(userProfilesTable).values(profileValues);
            console.log(`Created profile for ${email}`);
          }
        }
      }
    }

    // 2. Process Tasks
    const tasksDbStr = storage["concord_local_tasks"];
    if (!tasksDbStr) {
      console.warn("Warning: Key 'concord_local_tasks' not found in exported file. No tasks will be migrated.");
    } else {
      const tasksList = JSON.parse(tasksDbStr);
      console.log(`Found ${tasksList.length} task(s) to migrate...`);

      let insertedCount = 0;
      for (const t of tasksList) {
        const priority = ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium";
        const status = ["pending", "in_progress", "completed"].includes(t.status) ? t.status : "pending";
        
        await db.insert(tasksTable).values({
          userId: t.userId || defaultUserId,
          title: t.title || "Untitled Task",
          rawInput: t.rawInput || t.title || "Rest",
          summary: t.summary || null,
          category: t.category || null,
          priority: priority,
          status: status,
          deadline: t.deadline ? new Date(t.deadline) : null,
          keywords: Array.isArray(t.keywords) ? t.keywords : [],
          scheduledDate: t.scheduledDate || null,
          duration: t.duration || "30",
          overdueNotifiedAt: t.overdueNotifiedAt ? new Date(t.overdueNotifiedAt) : null,
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
        });
        insertedCount++;
      }
      console.log(`Successfully migrated ${insertedCount} tasks!`);
    }

    // 3. Process Chat messages
    const chatDbStr = storage["concord_local_chat"];
    if (!chatDbStr) {
      console.warn("Warning: Key 'concord_local_chat' not found in exported file. No chat messages will be migrated.");
    } else {
      const chatList = JSON.parse(chatDbStr);
      console.log(`Found ${chatList.length} chat message(s) to migrate...`);

      let insertedChatCount = 0;
      for (const c of chatList) {
        const role = ["user", "assistant"].includes(c.role) ? c.role : "user";
        await db.insert(chatMessagesTable).values({
          userId: c.userId || defaultUserId,
          role: role,
          content: c.content || "",
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        });
        insertedChatCount++;
      }
      console.log(`Successfully migrated ${insertedChatCount} chat messages!`);
    }

    // 4. Process Mood logs
    const moodDbStr = storage["concord_local_mood"];
    if (!moodDbStr) {
      console.warn("Warning: Key 'concord_local_mood' not found in exported file. No mood logs will be migrated.");
    } else {
      const moodList = JSON.parse(moodDbStr);
      console.log(`Found ${moodList.length} mood log(s) to migrate...`);

      let insertedMoodCount = 0;
      for (const m of moodList) {
        const val = m.value || {};
        const label = m.label || val.label || "neutral";
        const happy = m.happy !== undefined ? m.happy : val.happy !== undefined ? val.happy : 5;
        const sad = m.sad !== undefined ? m.sad : val.sad !== undefined ? val.sad : 5;
        const stress = m.stress !== undefined ? m.stress : val.stress !== undefined ? val.stress : 5;
        const fatigue = m.fatigue !== undefined ? m.fatigue : val.fatigue !== undefined ? val.fatigue : 5;
        const energy = m.energy !== undefined ? m.energy : val.energy !== undefined ? val.energy : 5;

        await db.insert(moodHistoryTable).values({
          userId: m.userId || defaultUserId,
          label: label,
          happy: Number(happy),
          sad: Number(sad),
          stress: Number(stress),
          fatigue: Number(fatigue),
          energy: Number(energy),
          createdAt: m.timestamp ? new Date(m.timestamp) : m.createdAt ? new Date(m.createdAt) : new Date(),
        });
        insertedMoodCount++;
      }
      console.log(`Successfully migrated ${insertedMoodCount} mood logs!`);
    }

    console.log("\nMigration completed successfully! 🎉");
  } catch (err) {
    console.error("Migration failed with error:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
