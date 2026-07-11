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
// בדיקת Variables
// =====================

console.log("TOKEN exists:", Boolean(process.env.TOKEN));
console.log("CLIENT_ID exists:", Boolean(process.env.CLIENT_ID));
console.log("GUILD_ID exists:", Boolean(process.env.GUILD_ID));
console.log(
  "CASINO ROLE exists:",
  Boolean(process.env.CASINO_MANAGER_ROLE_ID)
);

if (!process.env.TOKEN) {
  console.error("❌ TOKEN חסר");
  process.exit(1);
}

// =====================
// CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
client.buttonHandlers = [];

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

console.log(
  `📂 נמצאו ${commandFiles.length} קבצים בתיקיית commands`
);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    delete require.cache[require.resolve(filePath)];

    const moduleData = require(filePath);

    // תומך גם בקובץ עם פקודה אחת
    // וגם ב־casino.js שמכיל מערך commands
    const loadedCommands = Array.isArray(moduleData.commands)
      ? moduleData.commands
      : moduleData.data
        ? [moduleData]
        : [];

    if (loadedCommands.length === 0) {
      console.warn(
        `⚠️ הקובץ ${file} לא החזיר פקודות`
      );
    }

    for (const command of loadedCommands) {
      if (!command?.data?.name) {
        console.warn(
          `⚠️ נמצאה פקודה לא תקינה בתוך ${file}`
        );

        continue;
      }

      if (typeof command.execute !== "function") {
        console.warn(
          `⚠️ לפקודה /${command.data.name} אין execute`
        );

        continue;
      }

      if (client.commands.has(command.data.name)) {
        console.warn(
          `⚠️ הפקודה /${command.data.name} כבר קיימת`
        );

        continue;
      }

      client.commands.set(
        command.data.name,
        command
      );

      console.log(
        `✅ נטענה הפקודה /${command.data.name}`
      );
    }

    if (typeof moduleData.handleButton === "function") {
      client.buttonHandlers.push(
        moduleData.handleButton
      );

      console.log(
        `✅ נטען Button Handler מתוך ${file}`
      );
    }
  } catch (error) {
    console.error(
      `❌ שגיאה בטעינת הקובץ ${file}:`
    );

    console.error(error);
  }
}

// =====================
// READY
// =====================

client.once(Events.ClientReady, readyClient => {
  console.log(
    `✅ הבוט מחובר בתור ${readyClient.user.tag}`
  );

  console.log(
    `✅ נטענו ${client.commands.size} פקודות`
  );

  console.log(
    `✅ נטענו ${client.buttonHandlers.length} Button Handlers`
  );

  const leaderboardChannelId =
    process.env.LEADERBOARD_CHANNEL_ID ||
    "1524838815951229118";

  async function sendLeaderboard() {
    const command =
      client.commands.get("leaderboard");

    const channel =
      readyClient.channels.cache.get(
        leaderboardChannelId
      );

    if (!command) {
      console.log(
        "⚠️ הפקודה leaderboard לא נטענה"
      );

      return;
    }

    if (!channel?.isTextBased()) {
      console.log(
        "⚠️ חדר ה־Leaderboard לא נמצא"
      );

      return;
    }

    if (
      typeof command.buildLeaderboardEmbed !==
      "function"
    ) {
      console.log(
        "⚠️ אין buildLeaderboardEmbed בפקודת leaderboard"
      );

      return;
    }

    try {
      await channel.send({
        embeds: [
          command.buildLeaderboardEmbed()
        ]
      });
    } catch (error) {
      console.error(
        "❌ שגיאה בשליחת Leaderboard:",
        error
      );
    }
  }

  sendLeaderboard();

  setInterval(
    sendLeaderboard,
    60 * 60 * 1000
  );
});

// =====================
// INTERACTIONS
// =====================

client.on(
  Events.InteractionCreate,
  async interaction => {
    try {
      if (interaction.isButton()) {
        for (
          const handler of
          client.buttonHandlers
        ) {
          const handled =
            await handler(interaction);

          if (handled) return;
        }

        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      const command =
        client.commands.get(
          interaction.commandName
        );

      if (!command) {
        return interaction.reply({
          content:
            "❌ הפקודה הזאת לא נטענה בבוט.",
          ephemeral: true
        });
      }

      await command.execute(interaction);
    } catch (error) {
      console.error(
        `❌ שגיאה בפקודה או בכפתור:`,
        error
      );

      const response = {
        content:
          "❌ הייתה שגיאה בביצוע הפעולה.",
        ephemeral: true
      };

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        await interaction
          .followUp(response)
          .catch(() => {});
      } else {
        await interaction
          .reply(response)
          .catch(() => {});
      }
    }
  }
);

// =====================
// ERRORS
// =====================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught Exception:",
      error
    );
  }
);

// =====================
// LOGIN
// =====================

client.login(process.env.TOKEN);
