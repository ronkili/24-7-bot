require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const config = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("בודק אם הבוט עובד"),

  new SlashCommandBuilder()
    .setName("verify-panel")
    .setDescription("שולח פאנל Verify")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("שולח פאנל טיקטים")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // 👑 VIP Request
  new SlashCommandBuilder()
    .setName("vip-request")
    .setDescription("שליחת בקשה ל-VIP")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("המשתמש שיקבל VIP")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("למה מגיע לו VIP")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("approve-bot")
    .setDescription("ניהול בוטים מאושרים לאנטי ניוק")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("מאשר בוט לפי ID")
        .addStringOption(option =>
          option
            .setName("bot_id")
            .setDescription("ה-ID של הבוט")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("access")
            .setDescription("איזה גישה לתת לבוט")
            .setRequired(true)
            .addChoices(
              {
                name: "join_only - יכול להיכנס, נענש אם מוחק",
                value: "join_only"
              },
              {
                name: "trusted - בוט אמין",
                value: "trusted"
              }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("מוחק בוט מהרשימה")
        .addStringOption(option =>
          option
            .setName("bot_id")
            .setDescription("ה-ID של הבוט")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("מציג בוטים מאושרים")
    ),

  new SlashCommandBuilder()
    .setName("restore-channel")
    .setDescription("משחזר חדר שנמחק מהרשימה")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(option =>
      option
        .setName("channel")
        .setDescription("בחר חדר שנמחק")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addBooleanOption(option =>
      option
        .setName("restore_messages")
        .setDescription("לשחזר גם הודעות שמורות?")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("restore-role")
    .setDescription("משחזר רול שנמחק מהרשימה")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(option =>
      option
        .setName("role")
        .setDescription("בחר רול שנמחק")
        .setRequired(true)
        .setAutocomplete(true)
    )

].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deployCommands() {
  try {
    console.log("🔄 Registering slash commands...");

    if (!process.env.TOKEN) {
      console.log("❌ TOKEN missing in .env");
      process.exit(1);
    }

    if (!config.clientId) {
      console.log("❌ clientId missing in config.js");
      process.exit(1);
    }

    if (!config.guildId) {
      console.log("❌ guildId missing in config.js");
      process.exit(1);
    }

    await rest.put(
      Routes.applicationGuildCommands(
        config.clientId,
        config.guildId
      ),
      { body: commands }
    );

    console.log("✅ Slash commands registered!");
    console.log(`✅ Registered ${commands.length} commands`);
  } catch (error) {
    console.error("❌ Deploy error:", error);
  }
}

deployCommands();
