require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  REST,
  Routes
} = require("discord.js");

if (!process.env.TOKEN) {
  console.error("❌ TOKEN חסר");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("❌ CLIENT_ID חסר");
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.error("❌ GUILD_ID חסר");
  process.exit(1);
}

const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  console.error("❌ תיקיית commands לא קיימת");
  process.exit(1);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith(".js"));

const commands = [];
const commandNames = new Set();

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
        console.log(`⚠️ פקודה לא תקינה בתוך ${file}`);
        continue;
      }

      const commandName = command.data.name;

      if (commandNames.has(commandName)) {
        console.error(`❌ פקודה כפולה: /${commandName}`);
        process.exit(1);
      }

      commandNames.add(commandName);
      commands.push(command.data.toJSON());

      console.log(`✅ נטענה לרישום /${commandName}`);
    }
  } catch (error) {
    console.error(`❌ שגיאה בטעינת ${file}:`);
    console.error(error);
    process.exit(1);
  }
}

if (commands.length === 0) {
  console.error("❌ לא נמצאו פקודות לרישום");
  process.exit(1);
}

const rest = new REST({
  version: "10"
}).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`🔄 רושם ${commands.length} פקודות...`);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(`✅ נרשמו ${commands.length} פקודות בהצלחה`);
  } catch (error) {
    console.error("❌ Deploy error:");
    console.error(error);
  }
})();
