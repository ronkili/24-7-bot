require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
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

  new SlashCommandBuilder()
    .setName("vip-request")
    .setDescription("שולח בקשה ל־Owners לתת VIP למשתמש")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("המשתמש שעבורו מבקשים VIP")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("למה המשתמש צריך לקבל VIP")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(500)
    ),

  new SlashCommandBuilder()
    .setName("vip-requests")
    .setDescription("מציג כמה בקשות VIP זמינות נשארו לך"),

  new SlashCommandBuilder()
    .setName("add-vip-request")
    .setDescription("מוסיף בקשות VIP למשתמש - Owners בלבד")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("המשתמש שיקבל בקשות VIP")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("amount")
        .setDescription("כמה בקשות להוסיף")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("remove-vip-request")
    .setDescription("מוריד בקשות VIP ממשתמש - Owners בלבד")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("המשתמש שממנו יורידו בקשות VIP")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("amount")
        .setDescription("כמה בקשות להוריד")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("giveaway-start")
    .setDescription("פותח הגרלה")
    .addStringOption(option =>
      option.setName("prize")
        .setDescription("הפרס")
        .setRequired(true)
        .setMaxLength(200)
    )
    .addStringOption(option =>
      option.setName("duration")
        .setDescription("זמן: 30s / 10m / 2h / 3d")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("winners")
        .setDescription("כמות זוכים")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addStringOption(option =>
      option.setName("requirements")
        .setDescription("החובות להשתתפות בהגרלה")
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("החדר שבו תישלח ההגרלה")
        .setRequired(false)
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
    )
    .addAttachmentOption(option =>
      option.setName("image")
        .setDescription("תמונה שתופיע בהגרלה")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("giveaway-end")
    .setDescription("מסיים הגרלה")
    .addStringOption(option =>
      option.setName("giveaway_id")
        .setDescription("ה־ID של ההגרלה")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("giveaway-reroll")
    .setDescription("בוחר מחדש זוכים")
    .addStringOption(option =>
      option.setName("giveaway_id")
        .setDescription("ה־ID של ההגרלה")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("giveaway-access")
    .setDescription("ניהול גישה להגרלות - Owners בלבד")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("נותן גישה")
        .addUserOption(option =>
          option.setName("user")
            .setDescription("המשתמש שיקבל גישה")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("מסיר גישה")
        .addUserOption(option =>
          option.setName("user")
            .setDescription("המשתמש שממנו תוסר הגישה")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("מציג בעלי גישה")
    ),

  new SlashCommandBuilder()
    .setName("approve-bot")
    .setDescription("ניהול בוטים מאושרים לאנטי ניוק")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("מאשר בוט לפי ID")
        .addStringOption(option =>
          option.setName("bot_id")
            .setDescription("ה־ID של הבוט")
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName("access")
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
      sub.setName("remove")
        .setDescription("מוחק בוט מהרשימה")
        .addStringOption(option =>
          option.setName("bot_id")
            .setDescription("ה־ID של הבוט")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("מציג בוטים מאושרים")
    ),

  new SlashCommandBuilder()
    .setName("restore-channel")
    .setDescription("משחזר חדר שנמחק מהרשימה")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(option =>
      option.setName("channel")
        .setDescription("בחר חדר שנמחק")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addBooleanOption(option =>
      option.setName("restore_messages")
        .setDescription("לשחזר גם הודעות שמורות?")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("restore-role")
    .setDescription("משחזר רול שנמחק מהרשימה")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(option =>
      option.setName("role")
        .setDescription("בחר רול שנמחק")
        .setRequired(true)
        .setAutocomplete(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" })
  .setToken(process.env.TOKEN);

async function deployCommands() {
  try {
    if (!process.env.TOKEN) {
      console.log("❌ TOKEN missing in .env");
      process.exit(1);
    }

    if (!config.clientId || !config.guildId) {
      console.log("❌ clientId או guildId חסרים ב־config.js");
      process.exit(1);
    }

    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        config.clientId,
        config.guildId
      ),
      { body: commands }
    );

    console.log(`✅ Registered ${commands.length} commands`);
  } catch (error) {
    console.error("❌ Deploy error:", error);
  }
}

deployCommands();
