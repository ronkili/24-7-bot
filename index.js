require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  Collection,
  GatewayIntentBits,
  Events
} = require("discord.js");

// =====================
// בדיקת משתני סביבה
// =====================

if (!process.env.TOKEN) {
  console.error("❌ TOKEN חסר בקובץ .env");
  process.exit(1);
}

// =====================
// יצירת הבוט
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();

// =====================
// טעינת פקודות
// =====================

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
        `⚠️ הקובץ ${file} לא מכיל data ו־execute תקינים, ולכן הוא לא נטען.`
      );

      continue;
    }

    client.commands.set(command.data.name, command);

    console.log(`✅ נטענה הפקודה: /${command.data.name}`);
  } catch (error) {
    console.error(`❌ שגיאה בטעינת ${file}:`, error);
  }
}

// =====================
// הבוט מוכן
// =====================

client.once(Events.ClientReady, readyClient => {
  console.log(`✅ הבוט מחובר בתור ${readyClient.user.tag}`);
  console.log(`✅ נטענו ${client.commands.size} פקודות.`);
});

// =====================
// טיפול בפקודות
// =====================

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return interaction.reply({
      content: "❌ הפקודה הזאת לא נמצאה בבוט.",
      ephemeral: true
    }).catch(() => {});
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `❌ שגיאה בהפעלת /${interaction.commandName}:`,
      error
    );

    const errorMessage = {
      content: "❌ הייתה שגיאה בזמן הפעלת הפקודה.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
});

// =====================
// טיפול בשגיאות
// =====================

client.on(Events.Error, error => {
  console.error("❌ שגיאת Discord Client:", error);
});

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});

// =====================
// התחברות
// =====================

client.login(process.env.TOKEN);