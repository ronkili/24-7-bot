require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  PermissionFlagsBits,
  AuditLogEvent,
  Events,
  AttachmentBuilder,
  ActivityType
} = require("discord.js");

const config = require("./config");

// =====================
// DATA
// =====================

const DATA_DIR = path.join(__dirname, "data");
const BACKUP_FILE = path.join(DATA_DIR, "messages.json");
const ALLOWED_BOTS_FILE = path.join(DATA_DIR, "allowed-bots.json");
const DELETED_CHANNELS_FILE = path.join(DATA_DIR, "deleted-channels.json");
const DELETED_ROLES_FILE = path.join(DATA_DIR, "deleted-roles.json");
const VIP_REQUESTS_FILE = path.join(DATA_DIR, "vip-requests.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("Save JSON error:", error.message);
  }
}

const messageBackups = loadJson(BACKUP_FILE, {});
const allowedBotsData = loadJson(ALLOWED_BOTS_FILE, {});
const deletedChannelsData = loadJson(DELETED_CHANNELS_FILE, {});
const deletedRolesData = loadJson(DELETED_ROLES_FILE, {});
const vipRequestsData = loadJson(VIP_REQUESTS_FILE, {});

// =====================
// CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel]
});

function updateMemberPresence() {
  const guild = client.guilds.cache.get(config.guildId);

  if (!guild || !client.user) return;

  client.user.setPresence({
    status: "idle",
    afk: true,
    activities: [
      {
        name: `${guild.memberCount.toLocaleString("en-US")} Members`,
        type: ActivityType.Watching
      }
    ]
  });

  console.log(
    `🌙 Presence updated: Watching ${guild.memberCount.toLocaleString("en-US")} Members`
  );
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);

  updateMemberPresence();

  setInterval(updateMemberPresence, 60 * 1000);
});

client.on(Events.GuildMemberAdd, () => {
  updateMemberPresence();
});

client.on(Events.GuildMemberRemove, () => {
  updateMemberPresence();
});

// =====================
// HELPERS
// =====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getConfigAllowedBotIds() {
  return Array.isArray(config.allowedBotIds) ? config.allowedBotIds : [];
}

function isAllowedBot(id) {
  return getConfigAllowedBotIds().includes(id) || Boolean(allowedBotsData[id]);
}

function getBotAccess(id) {
  if (getConfigAllowedBotIds().includes(id)) return "trusted";
  return allowedBotsData[id]?.access || null;
}

function isTrustedBot(id) {
  return getBotAccess(id) === "trusted";
}

async function sendSecurityLog(guild, content) {
  const channel = guild.channels.cache.get(config.securityLogChannelId);
  if (!channel) return;

  channel.send({ content }).catch(() => {});
}


function hasVipConfig() {
  return Boolean(
    config.vipRoleId &&
    config.staffRoleId &&
    config.ownerRoleId &&
    config.vipRequestsChannelId
  );
}

function isVipStaff(member) {
  return Boolean(member?.roles?.cache?.has(config.staffRoleId));
}

function isVipOwner(member) {
  return Boolean(member?.roles?.cache?.has(config.ownerRoleId));
}

function vipRequestButtons(targetId, requesterId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`vip_approve:${targetId}:${requesterId}`)
        .setLabel("אישור")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId(`vip_deny:${targetId}:${requesterId}`)
        .setLabel("דחייה")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

function buildVipNickname(member) {
  const currentName =
    member.nickname ||
    member.user.globalName ||
    member.user.username;

  const cleanName = currentName
    .replace(/^VIP\s*\|\s*/i, "")
    .trim();

  return `VIP | ${cleanName}`.slice(0, 32);
}


const VIP_REQUESTS_PER_MONTH = 3;

function getMonthIndex(date = new Date()) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function getMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

function getVipRequestAccount(userId) {
  const currentMonthIndex = getMonthIndex();

  if (!vipRequestsData[userId]) {
    vipRequestsData[userId] = {
      balance: VIP_REQUESTS_PER_MONTH,
      lastGrantMonthIndex: currentMonthIndex,
      lastGrantMonth: getMonthKey(),
      totalApproved: 0,
      totalReceived: VIP_REQUESTS_PER_MONTH
    };

    saveJson(VIP_REQUESTS_FILE, vipRequestsData);
    return vipRequestsData[userId];
  }

  const account = vipRequestsData[userId];

  if (!Number.isInteger(account.balance)) account.balance = 0;
  if (!Number.isInteger(account.totalApproved)) account.totalApproved = 0;
  if (!Number.isInteger(account.totalReceived)) account.totalReceived = 0;

  const lastMonthIndex = Number.isInteger(account.lastGrantMonthIndex)
    ? account.lastGrantMonthIndex
    : currentMonthIndex;

  const monthsPassed = Math.max(
    0,
    currentMonthIndex - lastMonthIndex
  );

  if (monthsPassed > 0) {
    const added = monthsPassed * VIP_REQUESTS_PER_MONTH;

    account.balance += added;
    account.totalReceived += added;
    account.lastGrantMonthIndex = currentMonthIndex;
    account.lastGrantMonth = getMonthKey();

    saveJson(VIP_REQUESTS_FILE, vipRequestsData);
  }

  return account;
}

function useVipRequest(userId) {
  const account = getVipRequestAccount(userId);

  if (account.balance < 1) {
    return {
      success: false,
      account
    };
  }

  account.balance -= 1;
  account.totalApproved += 1;

  saveJson(VIP_REQUESTS_FILE, vipRequestsData);

  return {
    success: true,
    account
  };
}

async function sendVerifyPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle("Verify ✅")
    .setDescription("לחץ על הכפתור, תקבל מספר, ואז תלחץ על המספר הנכון.");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("start_verify")
      .setLabel("Verify")
      .setStyle(ButtonStyle.Success)
  );

  return channel.send({ embeds: [embed], components: [row] });
}

function backupMessage(message) {
  if (!message.guild) return;
  if (message.author.bot) return;

  if (!messageBackups[message.channel.id]) {
    messageBackups[message.channel.id] = [];
  }

  messageBackups[message.channel.id].push({
    author: message.author.tag,
    authorId: message.author.id,
    content: message.content || "[בלי טקסט]",
    createdAt: new Date().toLocaleString("he-IL"),
    attachments: [...message.attachments.values()].map(a => a.url)
  });

  const limit = config.backupMessagesLimit || 50;

  if (messageBackups[message.channel.id].length > limit) {
    messageBackups[message.channel.id].shift();
  }

  saveJson(BACKUP_FILE, messageBackups);
}

function canRestoreChannelType(type) {
  return [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.GuildCategory,
    ChannelType.GuildForum
  ].includes(type);
}

function buildAutocompleteChoices(data, guildId, focusedValue) {
  const focused = String(focusedValue || "").toLowerCase();

  return Object.entries(data)
    .filter(([, item]) => item.guildId === guildId)
    .filter(([, item]) => {
      const name = `${item.name || ""} ${item.deletedByTag || ""} ${item.id || ""}`.toLowerCase();
      return name.includes(focused);
    })
    .sort((a, b) => new Date(b[1].deletedAt) - new Date(a[1].deletedAt))
    .slice(0, 25)
    .map(([id, item]) => ({
      name: `${item.name} | נמחק ע״י ${item.deletedByTag || "לא ידוע"}`.slice(0, 100),
      value: id
    }));
}

function getPermissionOverwrites(channel) {
  return channel.permissionOverwrites?.cache?.map(overwrite => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString()
  })) || [];
}

function parsePermissionOverwrites(overwrites) {
  return (overwrites || []).map(overwrite => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: BigInt(overwrite.allow),
    deny: BigInt(overwrite.deny)
  }));
}

async function getLatestAuditExecutor(guild, type, targetId) {
  await sleep(1200);

  const logs = await guild.fetchAuditLogs({
    limit: 3,
    type
  }).catch((error) => {
    console.log("Audit log error:", error.message);
    return null;
  });

  const entries = [...(logs?.entries.values() || [])];
  const entry = entries.find(e => String(e.targetId) === String(targetId)) || entries[0];

  if (!entry) return null;
  if (Date.now() - entry.createdTimestamp > 15000) return null;

  return entry.executor || null;
}

function saveDeletedChannel(oldChannel, executor) {
  if (!oldChannel.guild) return;
  if (!canRestoreChannelType(oldChannel.type)) return;

  deletedChannelsData[oldChannel.id] = {
    id: oldChannel.id,
    guildId: oldChannel.guild.id,
    name: oldChannel.name,
    type: oldChannel.type,
    parentId: oldChannel.parentId || null,
    rawPosition: oldChannel.rawPosition || 0,
    topic: "topic" in oldChannel ? oldChannel.topic || null : null,
    nsfw: "nsfw" in oldChannel ? Boolean(oldChannel.nsfw) : false,
    rateLimitPerUser: "rateLimitPerUser" in oldChannel ? oldChannel.rateLimitPerUser || 0 : 0,
    bitrate: "bitrate" in oldChannel ? oldChannel.bitrate || null : null,
    userLimit: "userLimit" in oldChannel ? oldChannel.userLimit || 0 : 0,
    permissionOverwrites: getPermissionOverwrites(oldChannel),
    deletedAt: new Date().toISOString(),
    deletedById: executor?.id || null,
    deletedByTag: executor?.tag || "לא ידוע"
  };

  saveJson(DELETED_CHANNELS_FILE, deletedChannelsData);
}

function saveDeletedRole(oldRole, executor) {
  if (!oldRole.guild) return;
  if (oldRole.managed) return;
  if (oldRole.id === oldRole.guild.id) return;

  deletedRolesData[oldRole.id] = {
    id: oldRole.id,
    guildId: oldRole.guild.id,
    name: oldRole.name,
    color: oldRole.color,
    hoist: oldRole.hoist,
    mentionable: oldRole.mentionable,
    permissions: oldRole.permissions.bitfield.toString(),
    position: oldRole.position,
    deletedAt: new Date().toISOString(),
    deletedById: executor?.id || null,
    deletedByTag: executor?.tag || "לא ידוע"
  };

  saveJson(DELETED_ROLES_FILE, deletedRolesData);
}

async function punishBotIfNeeded(guild, executor, actionText) {
  if (!executor?.bot) return;
  if (isTrustedBot(executor.id)) return;

  const botMember = await guild.members.fetch(executor.id).catch(() => null);

  if (botMember?.kickable) {
    await botMember.kick(`Anti-Nuke: ${actionText}`).catch(() => {});
    return sendSecurityLog(guild, `🚨 העפתי בוט שעשה פעולה מסוכנת: **${executor.tag}**\nפעולה: ${actionText}`);
  }

  return sendSecurityLog(
    guild,
    `⚠️ בוט עשה פעולה מסוכנת אבל לא הצלחתי להעיף אותו: **${executor.tag}**\nתבדוק שהרול של הבוט שלך גבוה ממנו.`
  );
}

// =====================
// TICKET HELPERS
// =====================

function hasTicketConfig() {
  return Boolean(
    config.ticketCategoryId &&
    config.ticketStaffRoleId &&
    config.ticketLogsChannelId
  );
}

// רק מי שיש לו את הרול config.ticketStaffRoleId יכול לקחת/לסגור טיקט.
// Administrator לבד לא מספיק.
function isTicketStaff(member) {
  return member.roles.cache.has(config.ticketStaffRoleId);
}

async function createTicketTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });

  const sorted = [...messages.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );

  let transcript = `Transcript for #${channel.name}\n`;
  transcript += `Channel ID: ${channel.id}\n`;
  transcript += `Created At: ${new Date().toLocaleString("he-IL")}\n\n`;

  for (const msg of sorted) {
    transcript += `[${msg.createdAt.toLocaleString("he-IL")}] ${msg.author.tag}: ${msg.content || "[בלי טקסט]"}\n`;

    msg.attachments.forEach(att => {
      transcript += `Attachment: ${att.url}\n`;
    });
  }

  return new AttachmentBuilder(Buffer.from(transcript, "utf8"), {
    name: `${channel.name}-transcript.txt`
  });
}

async function openSalesTicket(interaction, ticketData) {
  if (!hasTicketConfig()) {
    return interaction.reply({
      content: "❌ חסרים IDs של טיקטים ב־config.js: ticketCategoryId / ticketStaffRoleId / ticketLogsChannelId",
      ephemeral: true
    });
  }

  const existingChannel = interaction.guild.channels.cache.find(channel =>
    channel.topic?.includes(`ticketOwner:${interaction.user.id}`)
  );

  if (existingChannel) {
    return interaction.reply({
      content: `❌ כבר יש לך טיקט פתוח: ${existingChannel}`,
      ephemeral: true
    });
  }

  const safeName = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9א-ת]/g, "-")
    .slice(0, 20);

  const ticketChannel = await interaction.guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    topic: `ticketOwner:${interaction.user.id} | ticketType:${ticketData.name}`,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      {
        id: config.ticketStaffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ]
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("claim_sales_ticket")
      .setLabel("Claim Ticket")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("close_sales_ticket")
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content:
`${ticketData.emoji} **טיקט חדש נפתח**

👤 משתמש: <@${interaction.user.id}>
📌 סוג טיקט: **${ticketData.name}**

<@&${config.ticketStaffRoleId}>`,
    components: [row]
  });

  return interaction.reply({
    content: `✅ הטיקט שלך נפתח: ${ticketChannel}`,
    ephemeral: true
  });
}

// =====================
// ANTI-NUKE: BOT JOIN
// =====================

client.on("guildMemberAdd", async (member) => {
  if (!member.user.bot) return;

  if (!isAllowedBot(member.id)) {
    const kicked = await member.kick("Anti-Nuke: Unauthorized bot joined")
      .then(() => true)
      .catch(() => false);

    if (kicked) {
      return sendSecurityLog(
        member.guild,
        `🚨 העפתי בוט לא מאושר שנכנס לשרת: **${member.user.tag}**\nID: \`${member.id}\``
      );
    }

    return sendSecurityLog(
      member.guild,
      `⚠️ בוט לא מאושר נכנס אבל לא הצלחתי להעיף אותו: **${member.user.tag}**\nID: \`${member.id}\``
    );
  }

  return sendSecurityLog(
    member.guild,
    `✅ בוט מאושר נכנס: **${member.user.tag}**\nID: \`${member.id}\`\nגישה: \`${getBotAccess(member.id)}\``
  );
});

// =====================
// MESSAGE BACKUP
// =====================

client.on("messageCreate", async (message) => {
  backupMessage(message);
});

// =====================
// DELETION TRACKING
// =====================

client.on("channelDelete", async (oldChannel) => {
  if (!oldChannel.guild) return;
  if (!canRestoreChannelType(oldChannel.type)) return;

  const executor = await getLatestAuditExecutor(oldChannel.guild, AuditLogEvent.ChannelDelete, oldChannel.id);

  saveDeletedChannel(oldChannel, executor);

  await sendSecurityLog(
    oldChannel.guild,
    `🗑️ חדר נמחק ונשמר לשחזור ידני:\nחדר: **${oldChannel.name}**\nמחק: **${executor?.tag || "לא ידוע"}**\nכדי לשחזר: \`/restore-channel\``
  );

  await punishBotIfNeeded(oldChannel.guild, executor, "Deleted channel");
});

client.on("roleDelete", async (oldRole) => {
  if (!oldRole.guild) return;
  if (oldRole.managed) return;

  const executor = await getLatestAuditExecutor(oldRole.guild, AuditLogEvent.RoleDelete, oldRole.id);

  saveDeletedRole(oldRole, executor);

  await sendSecurityLog(
    oldRole.guild,
    `🗑️ רול נמחק ונשמר לשחזור ידני:\nרול: **${oldRole.name}**\nמחק: **${executor?.tag || "לא ידוע"}**\nכדי לשחזר: \`/restore-role\``
  );

  await punishBotIfNeeded(oldRole.guild, executor, "Deleted role");
});

// =====================
// INTERACTIONS
// =====================

client.on("interactionCreate", async (interaction) => {
  // AUTOCOMPLETE
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused();

    if (interaction.commandName === "restore-channel") {
      return interaction.respond(
        buildAutocompleteChoices(deletedChannelsData, interaction.guildId, focused)
      ).catch(() => {});
    }

    if (interaction.commandName === "restore-role") {
      return interaction.respond(
        buildAutocompleteChoices(deletedRolesData, interaction.guildId, focused)
      ).catch(() => {});
    }
  }

  // SELECT MENU
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId !== "ticket_type_select") return;

    const types = {
      support: { name: "תמיכה", emoji: "🆘" },
      buy: { name: "קנייה", emoji: "🛒" },
      drop: { name: "זכייה בדרופ", emoji: "🎁" },
      giveaway: { name: "זכייה בהגרלה", emoji: "🎉" },
      other: { name: "אחר", emoji: "❓" }
    };

    const ticketData = types[interaction.values[0]];

    return openSalesTicket(interaction, ticketData);
  }

  // SLASH COMMANDS
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ping") {
      return interaction.reply({
        content: "Pong ✅",
        ephemeral: true
      });
    }

    if (interaction.commandName === "verify-panel") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "אין לך גישה לזה.", ephemeral: true });
      }

      await sendVerifyPanel(interaction.channel);
      return interaction.reply({ content: "שלחתי פאנל Verify ✅", ephemeral: true });
    }

    if (interaction.commandName === "ticket-panel") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "אין לך גישה לזה.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("🎫 Tickets")
        .setDescription("לחץ על הכפתור כדי לבחור סוג טיקט.");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket_select")
          .setLabel("בחר סוג טיקט")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: "✅ פאנל הטיקטים נשלח.",
        ephemeral: true
      });
    }


    if (interaction.commandName === "vip-request") {
      await interaction.deferReply({ ephemeral: true });

      try {
        if (!hasVipConfig()) {
          return interaction.editReply(
            "❌ חסרים IDs של מערכת VIP ב־config.js."
          );
        }

        if (!isVipStaff(interaction.member)) {
          return interaction.editReply(
            "❌ רק מי שיש לו את רול ה־Staff יכול לשלוח בקשת VIP."
          );
        }

        const vipAccount = getVipRequestAccount(interaction.user.id);

        if (vipAccount.balance < 1) {
          return interaction.editReply(
            "❌ אין לך כרגע בקשות VIP זמינות. " +
            "תקבל עוד 3 בתחילת החודש הבא."
          );
        }

        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        if (!target || !reason) {
          return interaction.editReply(
            "❌ חסר משתמש או הסבר לבקשה."
          );
        }

        if (target.bot) {
          return interaction.editReply(
            "❌ אי אפשר לבקש VIP עבור בוט."
          );
        }

        const targetMember = await interaction.guild.members
          .fetch(target.id)
          .catch(() => null);

        if (!targetMember) {
          return interaction.editReply(
            "❌ לא מצאתי את המשתמש הזה בשרת."
          );
        }

        const vipRole = await interaction.guild.roles
          .fetch(config.vipRoleId)
          .catch(() => null);

        if (!vipRole) {
          return interaction.editReply(
            "❌ לא מצאתי את רול ה־VIP. בדוק את vipRoleId ב־config.js."
          );
        }

        if (targetMember.roles.cache.has(vipRole.id)) {
          return interaction.editReply(
            "❌ למשתמש הזה כבר יש VIP."
          );
        }

        const requestsChannel = await interaction.guild.channels
          .fetch(config.vipRequestsChannelId)
          .catch(() => null);

        if (!requestsChannel?.isTextBased()) {
          return interaction.editReply(
            "❌ לא מצאתי את חדר בקשות ה־VIP. בדוק את vipRequestsChannelId."
          );
        }

        const botMember = await interaction.guild.members
          .fetchMe()
          .catch(() => null);

        const channelPermissions = botMember
          ? requestsChannel.permissionsFor(botMember)
          : null;

        if (
          !channelPermissions?.has(PermissionFlagsBits.ViewChannel) ||
          !channelPermissions?.has(PermissionFlagsBits.SendMessages) ||
          !channelPermissions?.has(PermissionFlagsBits.EmbedLinks)
        ) {
          return interaction.editReply(
            "❌ לבוט חסרות הרשאות בחדר בקשות ה־VIP.\n" +
            "צריך: View Channel, Send Messages ו־Embed Links."
          );
        }

        const requestEmbed = new EmbedBuilder()
          .setColor("Gold")
          .setTitle("👑 בקשת VIP חדשה")
          .addFields(
            {
              name: "👤 נשלחה על ידי",
              value: `${interaction.user} (\`${interaction.user.id}\`)`
            },
            {
              name: "🎯 בקשה עבור",
              value: `${target} (\`${target.id}\`)`
            },
            {
              name: "📝 סיבה",
              value: reason.slice(0, 1024)
            },
            {
              name: "🎟️ בקשות זמינות למבקש",
              value:
                `**${vipAccount.balance}**\n` +
                "בקשה תרד רק אם ה־Owner יאשר."
            }
          )
          .setThumbnail(target.displayAvatarURL())
          .setFooter({
            text: "רק בעלי רול Owners יכולים לאשר או לדחות"
          })
          .setTimestamp();

        await requestsChannel.send({
          content: `<@&${config.ownerRoleId}>`,
          embeds: [requestEmbed],
          components: vipRequestButtons(
            target.id,
            interaction.user.id
          ),
          allowedMentions: {
            roles: [config.ownerRoleId]
          }
        });

        return interaction.editReply(
          `✅ בקשת ה־VIP עבור ${target} נשלחה ל־Owners.\n` +
          `🎟️ יש לך כרגע **${vipAccount.balance}** בקשות זמינות. ` +
          "הבקשה תרד רק אם תאושר."
        );
      } catch (error) {
        console.error("VIP request error:", error);

        return interaction.editReply(
          "❌ הייתה שגיאה בשליחת בקשת ה־VIP.\n" +
          `שגיאה: \`${error.code || error.message}\``
        ).catch(() => {});
      }
    }


    if (interaction.commandName === "vip-requests") {
      if (!hasVipConfig()) {
        return interaction.reply({
          content: "❌ חסרים IDs של מערכת VIP ב־config.js.",
          ephemeral: true
        });
      }

      if (!isVipStaff(interaction.member)) {
        return interaction.reply({
          content:
            "❌ רק מי שיש לו את רול ה־Staff יכול לבדוק בקשות VIP.",
          ephemeral: true
        });
      }

      const account = getVipRequestAccount(interaction.user.id);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Gold")
            .setTitle("👑 מאגר בקשות VIP")
            .setDescription(
              `🎟️ בקשות זמינות: **${account.balance}**\n` +
              `➕ תוספת חודשית: **${VIP_REQUESTS_PER_MONTH}**\n` +
              `✅ בקשות שאושרו בסך הכול: **${account.totalApproved}**\n\n` +
              "בקשות שלא נוצלו נשמרות ומצטברות לחודשים הבאים."
            )
            .setFooter({
              text:
                `העדכון החודשי האחרון: ` +
                `${account.lastGrantMonth || getMonthKey()}`
            })
            .setTimestamp()
        ],
        ephemeral: true
      });
    }


    if (
      interaction.commandName === "add-vip-request" ||
      interaction.commandName === "remove-vip-request"
    ) {
      if (!hasVipConfig()) {
        return interaction.reply({
          content: "❌ חסרים IDs של מערכת VIP ב־config.js.",
          ephemeral: true
        });
      }

      if (!isVipOwner(interaction.member)) {
        return interaction.reply({
          content:
            "❌ רק מי שיש לו את רול ה־Owners יכול להשתמש בפקודה הזאת.",
          ephemeral: true
        });
      }

      const target = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");

      if (!target || !Number.isInteger(amount) || amount < 1) {
        return interaction.reply({
          content: "❌ המשתמש או הכמות אינם תקינים.",
          ephemeral: true
        });
      }

      if (target.bot) {
        return interaction.reply({
          content: "❌ אי אפשר לנהל בקשות VIP של בוט.",
          ephemeral: true
        });
      }

      const account = getVipRequestAccount(target.id);
      const before = account.balance;
      const isAdd =
        interaction.commandName === "add-vip-request";

      if (isAdd) {
        account.balance += amount;
        account.totalReceived += amount;
      } else {
        account.balance = Math.max(
          0,
          account.balance - amount
        );
      }

      saveJson(VIP_REQUESTS_FILE, vipRequestsData);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(isAdd ? "Green" : "Red")
            .setTitle(
              isAdd
                ? "✅ נוספו בקשות VIP"
                : "➖ הוסרו בקשות VIP"
            )
            .setDescription(
              `👤 משתמש: ${target}\n` +
              `📦 לפני: **${before}**\n` +
              `🔄 שינוי: **${isAdd ? "+" : "-"}${amount}**\n` +
              `🎟️ עכשיו: **${account.balance}**`
            )
            .setFooter({
              text: `בוצע על ידי ${interaction.user.tag}`
            })
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    if (interaction.commandName === "approve-bot") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "רק אדמין יכול להשתמש בזה.", ephemeral: true });
      }

      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const botId = interaction.options.getString("bot_id");
        const access = interaction.options.getString("access");

        if (!/^\d{17,20}$/.test(botId)) {
          return interaction.reply({ content: "זה לא נראה כמו ID תקין של בוט 😭", ephemeral: true });
        }

        allowedBotsData[botId] = {
          access,
          addedBy: interaction.user.id,
          addedAt: new Date().toISOString()
        };

        saveJson(ALLOWED_BOTS_FILE, allowedBotsData);

        const note = access === "trusted"
          ? "הבוט הזה לא ייענש אם הוא ימחק חדר/רול."
          : "הבוט הזה יכול להיכנס, אבל אם הוא מוחק חדר/רול הוא יעוף.";

        return interaction.reply({
          content: `✅ אישרתי את הבוט:\nID: \`${botId}\`\nגישה: \`${access}\`\n\n${note}`,
          ephemeral: true
        });
      }

      if (sub === "remove") {
        const botId = interaction.options.getString("bot_id");

        if (!allowedBotsData[botId]) {
          return interaction.reply({ content: "הבוט הזה לא נמצא ברשימה של הפקודה.", ephemeral: true });
        }

        delete allowedBotsData[botId];
        saveJson(ALLOWED_BOTS_FILE, allowedBotsData);

        return interaction.reply({ content: `🗑️ מחקתי את הבוט מהרשימה: \`${botId}\``, ephemeral: true });
      }

      if (sub === "list") {
        const configBots = getConfigAllowedBotIds();
        const dynamicBots = Object.entries(allowedBotsData);

        const configText = configBots.length
          ? configBots.map(id => `🔒 \`${id}\` — trusted מה־config.js`).join("\n")
          : "אין.";

        const dynamicText = dynamicBots.length
          ? dynamicBots.map(([id, data]) => `🤖 \`${id}\` — \`${data.access}\``).join("\n")
          : "אין.";

        return interaction.reply({
          content: `**בוטים קבועים:**\n${configText}\n\n**בוטים שאושרו דרך פקודה:**\n${dynamicText}`,
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === "restore-channel") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: "צריך Manage Channels בשביל זה.", ephemeral: true });
      }

      const deletedChannelId = interaction.options.getString("channel");
      const restoreMessages = interaction.options.getBoolean("restore_messages");
      const data = deletedChannelsData[deletedChannelId];

      if (!data || data.guildId !== interaction.guildId) {
        return interaction.reply({ content: "לא מצאתי את החדר הזה ברשימת המחוקים 💔", ephemeral: true });
      }

      if (!canRestoreChannelType(data.type)) {
        return interaction.reply({ content: "אי אפשר לשחזר את סוג החדר הזה אוטומטית.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const parentExists = data.parentId && interaction.guild.channels.cache.has(data.parentId);

      const createOptions = {
        name: data.name,
        type: data.type,
        parent: data.type === ChannelType.GuildCategory ? null : parentExists ? data.parentId : null,
        permissionOverwrites: parsePermissionOverwrites(data.permissionOverwrites),
        reason: `Manual restore by ${interaction.user.tag}`
      };

      if ([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(data.type)) {
        if (data.topic) createOptions.topic = data.topic;
        createOptions.nsfw = Boolean(data.nsfw);
        createOptions.rateLimitPerUser = data.rateLimitPerUser || 0;
      }

      if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(data.type)) {
        if (data.bitrate) createOptions.bitrate = data.bitrate;
        createOptions.userLimit = data.userLimit || 0;
      }

      const restoredChannel = await interaction.guild.channels.create(createOptions).catch((error) => {
        console.log("Restore channel error:", error);
        return null;
      });

      if (!restoredChannel) {
        return interaction.editReply("לא הצלחתי לשחזר את החדר. תבדוק שיש לבוט Manage Channels ושהרול שלו גבוה מספיק 💔");
      }

      await restoredChannel.setPosition(data.rawPosition || 0).catch(() => {});

      if (restoreMessages && restoredChannel.isTextBased?.() && typeof restoredChannel.send === "function") {
        const savedMessages = messageBackups[deletedChannelId] || [];

        if (savedMessages.length > 0) {
          await restoredChannel.send("✅ החדר שוחזר. אלו ההודעות האחרונות שנשמרו:").catch(() => {});

          for (const msg of savedMessages) {
            let text = `**${msg.author}** | ${msg.createdAt}\n${msg.content}`;

            if (msg.attachments.length > 0) {
              text += `\nקבצים:\n${msg.attachments.join("\n")}`;
            }

            await restoredChannel.send(text.slice(0, 1900)).catch(() => {});
          }
        } else {
          await restoredChannel.send("✅ החדר שוחזר, אבל לא היו לי הודעות שמורות ממנו.").catch(() => {});
        }
      }

      delete deletedChannelsData[deletedChannelId];
      saveJson(DELETED_CHANNELS_FILE, deletedChannelsData);

      await sendSecurityLog(
        interaction.guild,
        `♻️ חדר שוחזר ידנית:\nחדר: ${restoredChannel}\nשוחזר ע״י: **${interaction.user.tag}**\nהודעות: **${restoreMessages ? "כן" : "לא"}**`
      );

      return interaction.editReply(`✅ שיחזרתי את החדר: ${restoredChannel}`);
    }

    if (interaction.commandName === "restore-role") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: "צריך Manage Roles בשביל זה.", ephemeral: true });
      }

      const deletedRoleId = interaction.options.getString("role");
      const data = deletedRolesData[deletedRoleId];

      if (!data || data.guildId !== interaction.guildId) {
        return interaction.reply({ content: "לא מצאתי את הרול הזה ברשימת המחוקים 💔", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const botMember = await interaction.guild.members.fetchMe();

      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply("לבוט אין Manage Roles 💔");
      }

      const createdRole = await interaction.guild.roles.create({
        name: data.name,
        color: data.color || undefined,
        hoist: Boolean(data.hoist),
        mentionable: Boolean(data.mentionable),
        permissions: BigInt(data.permissions || "0"),
        reason: `Manual role restore by ${interaction.user.tag}`
      }).catch((error) => {
        console.log("Restore role error:", error);
        return null;
      });

      if (!createdRole) {
        return interaction.editReply("לא הצלחתי לשחזר את הרול. תבדוק Manage Roles ושהרול של הבוט גבוה מספיק 💔");
      }

      const maxPosition = Math.max(botMember.roles.highest.position - 1, 1);
      const wantedPosition = Math.min(data.position || 1, maxPosition);
      await createdRole.setPosition(wantedPosition).catch(() => {});

      delete deletedRolesData[deletedRoleId];
      saveJson(DELETED_ROLES_FILE, deletedRolesData);

      await sendSecurityLog(
        interaction.guild,
        `♻️ רול שוחזר ידנית:\nרול: **${createdRole.name}**\nשוחזר ע״י: **${interaction.user.tag}**`
      );

      return interaction.editReply(`✅ שיחזרתי את הרול: **${createdRole.name}**`);
    }
  }

  // BUTTONS
  if (!interaction.isButton()) return;

  if (interaction.customId === "open_ticket_select") {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_type_select")
        .setPlaceholder("בחר סוג טיקט")
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("תמיכה")
            .setEmoji("🆘")
            .setValue("support"),

          new StringSelectMenuOptionBuilder()
            .setLabel("קנייה")
            .setEmoji("🛒")
            .setValue("buy"),

          new StringSelectMenuOptionBuilder()
            .setLabel("זכייה בדרופ")
            .setEmoji("🎁")
            .setValue("drop"),

          new StringSelectMenuOptionBuilder()
            .setLabel("זכייה בהגרלה")
            .setEmoji("🎉")
            .setValue("giveaway"),

          new StringSelectMenuOptionBuilder()
            .setLabel("אחר")
            .setEmoji("❓")
            .setValue("other")
        )
    );

    return interaction.reply({
      content: "בחר את סוג הטיקט:",
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.customId === "claim_sales_ticket") {
    if (!hasTicketConfig()) {
      return interaction.reply({
        content: "❌ חסרים IDs של טיקטים ב־config.js.",
        ephemeral: true
      });
    }

    if (!isTicketStaff(interaction.member)) {
      return interaction.reply({
        content: "❌ רק צוות יכול לקחת טיקטים.",
        ephemeral: true
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claimed_sales_ticket")
        .setLabel(`Claimed by ${interaction.user.username}`)
        .setEmoji("🙋")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId("close_sales_ticket")
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({
      components: [row]
    });

    return interaction.channel.send(
      `🙋 הטיקט נלקח על ידי <@${interaction.user.id}>`
    ).catch(() => {});
  }

  if (interaction.customId === "close_sales_ticket") {
    if (!hasTicketConfig()) {
      return interaction.reply({
        content: "❌ חסרים IDs של טיקטים ב־config.js.",
        ephemeral: true
      });
    }

    if (!isTicketStaff(interaction.member)) {
      return interaction.reply({
        content: "❌ רק צוות יכול לסגור טיקטים.",
        ephemeral: true
      });
    }

    const logsChannel = interaction.guild.channels.cache.get(config.ticketLogsChannelId);
    const transcriptFile = await createTicketTranscript(interaction.channel).catch(() => null);

    if (logsChannel) {
      await logsChannel.send({
        content:
`🔒 **Ticket Closed**

🎫 טיקט: ${interaction.channel.name}
👤 נסגר על ידי: <@${interaction.user.id}>`,
        files: transcriptFile ? [transcriptFile] : []
      }).catch(() => {});
    }

    await interaction.reply("🔒 הטיקט ייסגר בעוד 5 שניות...");

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);

    return;
  }


  if (
    interaction.customId.startsWith("vip_approve:") ||
    interaction.customId.startsWith("vip_deny:")
  ) {
    try {
      if (!hasVipConfig()) {
        return interaction.reply({
          content: "❌ חסרים IDs של מערכת VIP ב־config.js.",
          ephemeral: true
        });
      }

      if (!isVipOwner(interaction.member)) {
        return interaction.reply({
          content: "❌ רק מי שיש לו את רול ה־Owners יכול לטפל בבקשה.",
          ephemeral: true
        });
      }

      const [action, targetId, requesterId] =
        interaction.customId.split(":");

      const approved = action === "vip_approve";

      if (!approved) {
        const deniedEmbed = EmbedBuilder
          .from(interaction.message.embeds[0])
          .setColor("Red")
          .setTitle("❌ בקשת VIP נדחתה")
          .addFields({
            name: "טופל על ידי",
            value: `${interaction.user}`
          })
          .setTimestamp();

        await interaction.update({
          content: "",
          embeds: [deniedEmbed],
          components: vipRequestButtons(
            targetId,
            requesterId,
            true
          )
        });

        const requester = await interaction.guild.members
          .fetch(requesterId)
          .catch(() => null);

        requester?.send(
          `❌ בקשת ה־VIP ששלחת עבור <@${targetId}> נדחתה על ידי ${interaction.user.tag}.`
        ).catch(() => {});

        return;
      }

      await interaction.deferUpdate();

      const targetMember = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      const vipRole = await interaction.guild.roles
        .fetch(config.vipRoleId)
        .catch(() => null);

      const botMember = await interaction.guild.members
        .fetchMe()
        .catch(() => null);

      if (!targetMember) {
        return interaction.followUp({
          content: "❌ המשתמש כבר לא נמצא בשרת.",
          ephemeral: true
        });
      }

      if (!vipRole) {
        return interaction.followUp({
          content: "❌ רול ה־VIP לא נמצא.",
          ephemeral: true
        });
      }

      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.followUp({
          content: "❌ לבוט אין Manage Roles.",
          ephemeral: true
        });
      }

      if (vipRole.position >= botMember.roles.highest.position) {
        return interaction.followUp({
          content: "❌ רול הבוט חייב להיות מעל רול ה־VIP.",
          ephemeral: true
        });
      }

      if (!targetMember.manageable) {
        return interaction.followUp({
          content:
            "❌ הבוט לא יכול לשנות את הכינוי של המשתמש הזה. " +
            "תעלה את רול הבוט מעל הרול שלו.",
          ephemeral: true
        });
      }

      const requestUse = useVipRequest(requesterId);

      if (!requestUse.success) {
        return interaction.followUp({
          content:
            "❌ למי ששלח את הבקשה כבר אין בקשות VIP זמינות. " +
            "הבקשה לא אושרה ולא בוצע שינוי.",
          ephemeral: true
        });
      }

      const roleAdded = await targetMember.roles
        .add(
          vipRole,
          `VIP request approved by ${interaction.user.tag}`
        )
        .then(() => true)
        .catch(error => {
          console.error("VIP role add error:", error);
          return false;
        });

      if (!roleAdded) {
        requestUse.account.balance += 1;
        requestUse.account.totalApproved = Math.max(
          0,
          requestUse.account.totalApproved - 1
        );

        saveJson(VIP_REQUESTS_FILE, vipRequestsData);

        return interaction.followUp({
          content:
            "❌ לא הצלחתי להוסיף את רול ה־VIP. " +
            "הבקשה הוחזרה למבקש. בדוק הרשאות ומיקום רולים.",
          ephemeral: true
        });
      }

      const newNickname = buildVipNickname(targetMember);

      const nicknameChanged = await targetMember
        .setNickname(
          newNickname,
          `VIP approved by ${interaction.user.tag}`
        )
        .then(() => true)
        .catch(error => {
          console.error("VIP nickname error:", error);
          return false;
        });

      const approvedEmbed = EmbedBuilder
        .from(interaction.message.embeds[0])
        .setColor("Green")
        .setTitle("✅ בקשת VIP אושרה")
        .addFields(
          {
            name: "אושר על ידי",
            value: `${interaction.user}`
          },
          {
            name: "תוצאה",
            value:
              `רול VIP: **נוסף**\n` +
              `כינוי: **${
                nicknameChanged
                  ? newNickname
                  : "הרול נוסף, אך הכינוי לא שונה"
              }**\n` +
              `בקשות שנותרו למבקש: **${requestUse.account.balance}**`
          }
        )
        .setTimestamp();

      await interaction.message.edit({
        content: "",
        embeds: [approvedEmbed],
        components: vipRequestButtons(
          targetId,
          requesterId,
          true
        )
      });

      const requester = await interaction.guild.members
        .fetch(requesterId)
        .catch(() => null);

      requester?.send(
        `✅ בקשת ה־VIP ששלחת עבור ${targetMember.user.tag} אושרה על ידי ${interaction.user.tag}.`
      ).catch(() => {});

      targetMember.send(
        `👑 בקשת ה־VIP שלך אושרה! קיבלת את רול ה־VIP בשרת **${interaction.guild.name}**.`
      ).catch(() => {});

      return;
    } catch (error) {
      console.error("VIP button error:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({
          content:
            "❌ הייתה שגיאה בטיפול בבקשת ה־VIP.\n" +
            `שגיאה: \`${error.code || error.message}\``,
          ephemeral: true
        }).catch(() => {});
      }

      return interaction.reply({
        content:
          "❌ הייתה שגיאה בטיפול בבקשת ה־VIP.\n" +
          `שגיאה: \`${error.code || error.message}\``,
        ephemeral: true
      }).catch(() => {});
    }
  }

  if (interaction.customId === "start_verify") {
    const correct = String(Math.floor(1000 + Math.random() * 9000));
    const numbers = new Set([correct]);

    while (numbers.size < 4) {
      numbers.add(String(Math.floor(1000 + Math.random() * 9000)));
    }

    const shuffled = [...numbers].sort(() => Math.random() - 0.5);

    const row = new ActionRowBuilder().addComponents(
      shuffled.map(num =>
        new ButtonBuilder()
          .setCustomId(`verify:${interaction.user.id}:${correct}:${num}`)
          .setLabel(num)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    return interaction.reply({
      content: `המספר שלך הוא: **${correct}**\nתלחץ על הכפתור עם המספר הזה.`,
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith("verify:")) {
    const [, userId, correct, picked] = interaction.customId.split(":");

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "זה לא ה־verify שלך 😭", ephemeral: true });
    }

    if (picked !== correct) {
      return interaction.reply({ content: "לא נכון 💔 תלחץ שוב על Verify.", ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const botMember = await interaction.guild.members.fetchMe();
    const role = await interaction.guild.roles.fetch(config.memberRoleId).catch(() => null);

    if (!role) {
      return interaction.update({ content: "האימות הצליח, אבל לא מצאתי את הרול. תבדוק `memberRoleId` ב־config.js 💔", components: [] });
    }

    if (role.managed) {
      return interaction.update({ content: "האימות הצליח, אבל זה רול מנוהל שאי אפשר לתת ידנית 💔", components: [] });
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.update({ content: "האימות הצליח, אבל לבוט אין `Manage Roles` 💔", components: [] });
    }

    if (role.position >= botMember.roles.highest.position) {
      return interaction.update({ content: "האימות הצליח, אבל הרול של הבוט נמוך מדי. תעלה את הרול של הבוט מעל הרול של המאומת 😭", components: [] });
    }

    try {
      await member.roles.add(role, "Verify completed");
    } catch (error) {
      console.log("Role add error:", error);
      return interaction.update({
        content: `האימות הצליח, אבל לא הצלחתי לתת רול.\nשגיאה: \`${error.code || error.message}\``,
        components: []
      });
    }

    return interaction.update({ content: "אומתת בהצלחה ✅ קיבלת את הרול!", components: [] });
  }
});

// =====================
// LOGIN
// =====================

if (!process.env.TOKEN) {
  console.log("❌ TOKEN missing in .env");
  process.exit(1);
}

client.login(process.env.TOKEN).catch((error) => {
  console.log("Login error:", error.message);
});
