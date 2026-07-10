require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("בדיקת יתרת שקלים")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("משתמש")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("קבלת שקלים יומית"),

  new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("קבלת שקלים שבועית"),

  new SlashCommandBuilder()
    .setName("monthly")
    .setDescription("קבלת שקלים חודשית"),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("סטטיסטיקות קזינו")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("משתמש")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("טבלת עשירים"),

  new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("עץ או פלי")
    .addStringOption(o =>
      o.setName("choice")
        .setDescription("בחירה")
        .setRequired(true)
        .addChoices(
          { name: "עץ", value: "etz" },
          { name: "פלי", value: "pali" }
        )
    )
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("סכום הימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("רולטה")
    .addStringOption(o =>
      o.setName("bet")
        .setDescription("סוג הימור")
        .setRequired(true)
        .addChoices(
          { name: "אדום", value: "red" },
          { name: "שחור", value: "black" },
          { name: "ירוק", value: "green" },
          { name: "זוגי", value: "even" },
          { name: "אי זוגי", value: "odd" },
          { name: "נמוך 1-18", value: "low" },
          { name: "גבוה 19-36", value: "high" }
        )
    )
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("סכום הימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  new SlashCommandBuilder()
    .setName("crash")
    .setDescription("משחק Crash")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("סכום הימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  new SlashCommandBuilder()
    .setName("mines")
    .setDescription("משחק Mines")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("סכום הימור")
        .setRequired(true)
        .setMinValue(10)
    )
    .addIntegerOption(o =>
      o.setName("mines")
        .setDescription("כמות מוקשים 1-8")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(8)
    ),

  new SlashCommandBuilder()
    .setName("horserace")
    .setDescription("מרוץ סוסים")
    .addIntegerOption(o =>
      o.setName("horse")
        .setDescription("בחר סוס 1-5")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("סכום הימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  new SlashCommandBuilder()
    .setName("addmoney")
    .setDescription("הוספת שקלים - אחראי קזינו בלבד")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("משתמש")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("סכום")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("removemoney")
    .setDescription("הורדת שקלים - אחראי קזינו בלבד")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("משתמש")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("סכום")
        .setRequired(true)
        .setMinValue(1)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    if (!process.env.TOKEN) {
      console.log("❌ TOKEN חסר ב־.env");
      process.exit(1);
    }

    if (!process.env.CLIENT_ID) {
      console.log("❌ CLIENT_ID חסר ב־.env");
      process.exit(1);
    }

    if (!process.env.GUILD_ID) {
      console.log("❌ GUILD_ID חסר ב־.env");
      process.exit(1);
    }

    console.log("🔄 רושם פקודות קזינו...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(`✅ נרשמו ${commands.length} פקודות בהצלחה`);
  } catch (error) {
    console.error("❌ Deploy error:", error);
  }
})();