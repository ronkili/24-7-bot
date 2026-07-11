require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  Collection,
  GatewayIntentBits,
  Events
} = require("discord.js");

console.log("TOKEN exists:", Boolean(process.env.TOKEN));
console.log("CLIENT_ID exists:", Boolean(process.env.CLIENT_ID));
console.log("GUILD_ID exists:", Boolean(process.env.GUILD_ID));
console.log(
  "CASINO_MANAGER_ROLE_ID exists:",
  Boolean(process.env.CASINO_MANAGER_ROLE_ID)
);

if (!process.env.TOKEN) {
  console.error("❌ TOKEN חסר");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
client.buttonHandlers = [];
client.selectMenuHandlers = [];

// =====================
// טעינת פקודות
// =====================

const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath, { recursive: true });
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith(".js"));

console.log(`📂 נמצאו ${commandFiles.length} קבצים בתיקיית commands`);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    delete require.cache[require.resolve(filePath)];

    const moduleData = require(filePath);

    const loadedCommands = Array.isArray(moduleData.commands)
      ? moduleData.commands
      : moduleData.data
        ? [moduleData]
        : [];

    for (const command of loadedCommands) {
      if (!command?.data?.name) {
        console.log(`⚠️ נמצאה פקודה לא תקינה בתוך ${file}`);
        continue;
      }

      if (typeof command.execute !== "function") {
        console.log(`⚠️ לפקודה /${command.data.name} אין execute`);
        continue;
      }

      if (client.commands.has(command.data.name)) {
        console.log(`❌ פקודה כפולה: /${command.data.name}`);
        continue;
      }

      client.commands.set(command.data.name, command);
      console.log(`✅ נטענה הפקודה /${command.data.name}`);
    }

    if (typeof moduleData.handleButton === "function") {
      client.buttonHandlers.push(moduleData.handleButton);
      console.log(`✅ נטען Button Handler מתוך ${file}`);
    }

    if (typeof moduleData.handleSelectMenu === "function") {
      client.selectMenuHandlers.push(moduleData.handleSelectMenu);
      console.log(`✅ נטען Select Menu Handler מתוך ${file}`);
    }
  } catch (error) {
    console.error(`❌ שגיאה בטעינת ${file}:`);
    console.error(error);
  }
}

// =====================
// READY
// =====================

client.once(Events.ClientReady, async readyClient => {
  console.log(`✅ הבוט מחובר בתור ${readyClient.user.tag}`);
  console.log(`✅ נטענו ${client.commands.size} פקודות`);
  console.log(`✅ נטענו ${client.buttonHandlers.length} Button Handlers`);

  const leaderboardChannelId =
    process.env.LEADERBOARD_CHANNEL_ID || "1524838815951229118";

  async function sendLeaderboard() {
    const command = client.commands.get("leaderboard");
    const channel = readyClient.channels.cache.get(leaderboardChannelId);

    if (!command || !channel?.isTextBased()) return;

    if (typeof command.buildLeaderboardEmbed !== "function") return;

    await channel.send({
      embeds: [command.buildLeaderboardEmbed()]
    }).catch(error => {
      console.error("❌ שגיאה בשליחת Leaderboard:", error);
    });
  }

  await sendLeaderboard();

  setInterval(() => {
    sendLeaderboard();
  }, 60 * 60 * 1000);
});

// =====================
// INTERACTIONS
// =====================

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton()) {
      for (const handler of client.buttonHandlers) {
        const handled = await handler(interaction);

        if (handled) return;
      }

      return;
    }

    if (interaction.isStringSelectMenu()) {
      for (const handler of client.selectMenuHandlers) {
        const handled = await handler(interaction);

        if (handled) return;
      }

      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      return interaction.reply({
        content: "❌ הפקודה הזאת לא נטענה בבוט.",
        ephemeral: true
      });
    }

    await command.execute(interaction);
  } catch (error) {
    console.error("❌ שגיאה באינטראקציה:", error);

    const response = {
      content: "❌ הייתה שגיאה בביצוע הפעולה.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

// =====================
// ERRORS
// =====================

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});

// =====================
// LOGIN
// =====================

client.login(process.env.TOKEN);
