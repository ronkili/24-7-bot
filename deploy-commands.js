require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  REST,
  Routes
} = require("discord.js");

// =====================
// בדיקת משתני סביבה
// =====================

if (!process.env.TOKEN) {
  console.error("❌ TOKEN חסר בקובץ .env");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("❌ CLIENT_ID חסר בקובץ .env");
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.error("❌ GUILD_ID חסר בקובץ .env");
  process.exit(1);
}

// =====================
// טעינת הפקודות
// =====================

const commands = [];

const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  console.error("❌ לא נמצאה תיקיית commands");
  process.exit(1);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith(".js"));

console.log(`📂 נמצאו ${commandFiles.length} קבצי פקודות.`);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    delete require.cache[require.resolve(filePath)];

    const command = require(filePath);

    if (!command.data || typeof command.execute !== "function") {
      console.warn(
        `⚠️ הקובץ ${file} לא מכיל data ו־execute תקינים, ולכן הוא לא נרשם.`
      );

      continue;
    }

    commands.push(command.data.toJSON());

    console.log(`✅ נטענה לרישום הפקודה: /${command.data.name}`);
  } catch (error) {
    console.error(`❌ שגיאה בטעינת ${file}:`, error);
  }
}

// =====================
// רישום הפקודות
// =====================

const rest = new REST({
  version: "10"
}).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 רושם פקודות Slash בשרת...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(`✅ נרשמו ${commands.length} פקודות בהצלחה.`);
  } catch (error) {
    console.error("❌ שגיאה ברישום הפקודות:", error);
  }
})();