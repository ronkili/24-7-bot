require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const client = new Client({

    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]

});

// =======================
// שים כאן IDs
// =======================

const helpChannelId = "1496162286178406461";
const staffRoleId = "1496162203147964426";
const logsChannelId = "1497632395808215130";

// =======================
// Cooldown
// =======================

const cooldown = new Map();
const cooldownTime = 10 * 1000;

// =======================
// כשהבוט נדלק
// =======================

client.once('ready', () => {

    console.log(`✅ Logged in as ${client.user.tag}`);

});

// =======================
// !h Helping System
// =======================

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    if (message.content.toLowerCase().startsWith('!h')) {

        // Cooldown
        if (cooldown.has(message.author.id)) {

            const expirationTime =
                cooldown.get(message.author.id) + cooldownTime;

            if (Date.now() < expirationTime) {

                const timeLeft =
                    ((expirationTime - Date.now()) / 1000).toFixed(1);

                return message.reply(
                    `⏱️ חכה ${timeLeft} שניות לפני שאתה עושה !h שוב`
                );

            }

        }

        cooldown.set(message.author.id, Date.now());

        setTimeout(() => {

            cooldown.delete(message.author.id);

        }, cooldownTime);

        // סיבה
        let args = message.content.slice(2).trim();

        if (!args) {

            args = "אין סיבה";

        }

        const helpChannel =
            message.guild.channels.cache.get(helpChannelId);

        const logsChannel =
            message.guild.channels.cache.get(logsChannelId);

        if (!helpChannel) {

            return message.reply('❌ לא נמצא ערוץ help');

        }

        // כפתור Claim
        const claimButton = new ButtonBuilder()
            .setCustomId('claim_help')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(claimButton);

        // שליחה לערוץ help
        const sentMessage = await helpChannel.send({

            content:
`📩 **בקשת עזרה חדשה**

👤 משתמש: <@${message.author.id}>
📝 סיבה: ${args}

<@&${staffRoleId}>`,

            components: [row]

        });

        // לוג של פתיחת בקשה
        if (logsChannel) {

            logsChannel.send(
`📩 בקשת Help חדשה

👤 משתמש: <@${message.author.id}>
📝 סיבה: ${args}
🆔 Message ID: ${sentMessage.id}`
            );

        }

        // DM למשתמש
        try {

            await message.author.send(
`📩 בקשת העזרה שלך נשלחה לצוות!

📝 סיבה:
${args}`
            );

        } catch {}

    }

});

const {
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

// =======================
// שים כאן IDs
// =======================

const warnLogsChannelId = "1497959735607951430";


// =======================
// WARN COMMAND
// =======================

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    if (message.content.startsWith('!warn')) {

        // רק STAFF יכולים
        if (!message.member.roles.cache.has(staffRoleId)) {

            return message.reply("❌ אין לך הרשאה להשתמש בפקודה הזאת");

        }

        // תיוג משתמש
        const user = message.mentions.users.first();

        if (!user) {

            return message.reply("❌ תתייג משתמש");

        }

        // סיבה
        const args = message.content.split(' ').slice(2);
        const reason = args.join(' ') || "אין סיבה";

        const warnLogsChannel =
            message.guild.channels.cache.get(warnLogsChannelId);

        // זמן
        const now = new Date();

        // EMBED כמו בתמונה
        const warnEmbed = new EmbedBuilder()

            .setColor("Red")

            .setTitle("⚠️ Member Warned (Voice)")

            .addFields(

                {
                    name: "Moderator",
                    value: `<@${message.author.id}> (${message.author.tag})`
                },

                {
                    name: "Member",
                    value: `<@${user.id}> (${user.tag})`
                },

                {
                    name: "Reason",
                    value: reason
                },

                {
                    name: "Warn Time",
                    value: now.toLocaleString()
                }

            )

            .setFooter({

                text: `Moderation System • ${now.toLocaleString()}`

            });

        // שליחה לערוץ warn logs
        if (warnLogsChannel) {

            warnLogsChannel.send({

                embeds: [warnEmbed]

            });

        }

        // ניסיון לשלוח DM למשתמש
        try {

            await user.send({

                embeds: [warnEmbed]

            });

        } catch {}

        // אישור בצ'אט
        message.reply(`✅ <@${user.id}> קיבל Warn`);

    }

});
// =======================
// SLASH COMMAND HANDLER
// =======================

const fs = require('fs');
const path = require('path');

client.commands = new Map();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {

    const filePath =
        path.join(commandsPath, file);

    const command =
        require(filePath);

    client.commands.set(
        command.data.name,
        command
    );

}

// הפעלת Slash Commands

client.on('interactionCreate', async interaction => {

    if (!interaction.isChatInputCommand())
        return;

    const command =
        client.commands.get(
            interaction.commandName
        );

    if (!command) return;

    try {

        await command.execute(interaction);

    } catch (error) {

        console.error(error);

        if (!interaction.replied) {

            interaction.reply({
                content: "❌ הייתה שגיאה",
                ephemeral: true
            });

        }

    }

});

client.login(process.env.TOKEN);