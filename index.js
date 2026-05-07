require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const { addXp } = require('./utils/xpSystem');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// =======================
// IDs
// =======================

const helpChannelId = "1496162286178406461";
const staffRoleId = "1496162203147964426";
const logsChannelId = "1497632395808215130";
const memberRoleId = "1496162210542518346";

// =======================
// Cooldowns + Locks
// =======================

const helpCooldown = new Map();
const xpCooldown = new Map();
const handledMessages = new Set();
const verifyCodes = new Map();

const helpCooldownTime = 10 * 1000;
const xpCooldownTime = 60 * 1000;

// =======================
// Load Slash Commands
// =======================

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath)
        .filter(file => file.endsWith('.js'));

    console.log("📂 Command files found:", commandFiles);

    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            delete require.cache[require.resolve(filePath)];

            const command = require(filePath);

            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.log(`❌ Command file broken: ${file}`);
            }

        } catch (error) {
            console.log(`❌ Failed to load command file: ${file}`);
            console.error(error);
        }
    }
} else {
    console.log("❌ commands folder not found");
}

// =======================
// Ready
// =======================

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log("✅ RUNNING NEW INDEX WITHOUT HELP_SOURCE");
});

// =======================
// Message Handler
// Help + XP
// =======================

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;
        if (!message.guild) return;

        // =======================
        // !h Help System
        // =======================

        if (message.content.toLowerCase().startsWith('!h')) {

            if (handledMessages.has(message.id)) return;
            handledMessages.add(message.id);

            setTimeout(() => {
                handledMessages.delete(message.id);
            }, 60 * 1000);

            const helpChannel = message.guild.channels.cache.get(helpChannelId);
            const logsChannel = message.guild.channels.cache.get(logsChannelId);

            if (!helpChannel) {
                return message.reply('❌ לא נמצא ערוץ help');
            }

            if (helpCooldown.has(message.author.id)) {
                const expirationTime =
                    helpCooldown.get(message.author.id) + helpCooldownTime;

                if (Date.now() < expirationTime) {
                    const timeLeft =
                        ((expirationTime - Date.now()) / 1000).toFixed(1);

                    return message.reply(
                        `⏱️ חכה ${timeLeft} שניות לפני שאתה עושה !h שוב`
                    );
                }
            }

            helpCooldown.set(message.author.id, Date.now());

            setTimeout(() => {
                helpCooldown.delete(message.author.id);
            }, helpCooldownTime);

            let reason = message.content.slice(2).trim();

            if (!reason) {
                reason = "אין סיבה";
            }

            const claimButton = new ButtonBuilder()
                .setCustomId(`claim_help_${message.id}`)
                .setLabel('Claim')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(claimButton);

            const sentMessage = await helpChannel.send({
                content:
`📩 **בקשת עזרה חדשה**

👤 משתמש: <@${message.author.id}>
📝 סיבה: ${reason}

<@&${staffRoleId}>`,
                components: [row]
            });

            if (logsChannel) {
                logsChannel.send(
`📩 בקשת Help חדשה

👤 משתמש: <@${message.author.id}>
📝 סיבה: ${reason}
🆔 Message ID: ${sentMessage.id}`
                ).catch(() => {});
            }

            try {
                await message.author.send(
`📩 בקשת העזרה שלך נשלחה לצוות!

📝 סיבה:
${reason}`
                );
            } catch {}

            return;
        }

        // =======================
        // XP System
        // =======================

        if (message.content.startsWith('!')) return;

        const xpKey = `${message.guild.id}-${message.author.id}`;

        if (xpCooldown.has(xpKey)) return;

        xpCooldown.set(xpKey, true);

        setTimeout(() => {
            xpCooldown.delete(xpKey);
        }, xpCooldownTime);

        const randomXp = Math.floor(Math.random() * 11) + 5;
        const result = addXp(message.author.id, randomXp);

        if (result.leveledUp) {
            message.channel.send(
                `🎉 ${message.author} עלה לרמה **${result.user.level}**!`
            ).catch(() => {});
        }

    } catch (error) {
        console.error('❌ Message Error:', error);
    }
});

// =======================
// Interaction Handler
// Slash Commands + Verify + Claim
// =======================

client.on('interactionCreate', async (interaction) => {
    try {

        // =======================
        // Slash Commands
        // =======================

        if (interaction.isChatInputCommand()) {
            let command = client.commands.get(interaction.commandName);

            if (!command) {
                const commandPath = path.join(commandsPath, `${interaction.commandName}.js`);

                if (fs.existsSync(commandPath)) {
                    try {
                        delete require.cache[require.resolve(commandPath)];
                        command = require(commandPath);

                        if (command.data && command.execute) {
                            client.commands.set(command.data.name, command);
                            console.log(`✅ Loaded command on demand: ${command.data.name}`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to load command on demand: ${interaction.commandName}`, error);
                    }
                }
            }

            if (!command) {
                return interaction.reply({
                    content: '❌ הפקודה לא נמצאה בבוט.',
                    ephemeral: true
                });
            }

            await command.execute(interaction);
            return;
        }

        // =======================
        // Buttons
        // =======================

        if (interaction.isButton()) {

            // =======================
            // Verify Start
            // =======================

            if (interaction.customId === 'start_verify') {

                if (interaction.member.roles.cache.has(memberRoleId)) {
                    return interaction.reply({
                        content: '✅ אתה כבר מאומת.',
                        ephemeral: true
                    });
                }

                const correctCode =
                    Math.floor(1000 + Math.random() * 9000).toString();

                let codes = [correctCode];

                while (codes.length < 4) {
                    const fakeCode =
                        Math.floor(1000 + Math.random() * 9000).toString();

                    if (!codes.includes(fakeCode)) {
                        codes.push(fakeCode);
                    }
                }

                codes = codes.sort(() => Math.random() - 0.5);

                verifyCodes.set(interaction.user.id, correctCode);

                setTimeout(() => {
                    verifyCodes.delete(interaction.user.id);
                }, 2 * 60 * 1000);

                const verifyEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle(`Your Verification Code Is: ${correctCode}`);

                const row = new ActionRowBuilder()
                    .addComponents(
                        codes.map(code =>
                            new ButtonBuilder()
                                .setCustomId(`verify_answer_${code}`)
                                .setLabel(code)
                                .setStyle(ButtonStyle.Primary)
                        )
                    );

                return interaction.reply({
                    embeds: [verifyEmbed],
                    components: [row],
                    ephemeral: true
                });
            }

            // =======================
            // Verify Answer
            // =======================

            if (interaction.customId.startsWith('verify_answer_')) {

                const selectedCode =
                    interaction.customId.replace('verify_answer_', '');

                const correctCode =
                    verifyCodes.get(interaction.user.id);

                if (!correctCode) {
                    return interaction.reply({
                        content: '❌ אין לך אימות פעיל. לחץ שוב על Verify.',
                        ephemeral: true
                    });
                }

                if (selectedCode !== correctCode) {
                    return interaction.reply({
                        content: '❌ קוד שגוי. נסה שוב.',
                        ephemeral: true
                    });
                }

                const memberRole =
                    interaction.guild.roles.cache.get(memberRoleId);

                if (!memberRole) {
                    return interaction.reply({
                        content: '❌ רול Member לא נמצא.',
                        ephemeral: true
                    });
                }

                await interaction.member.roles.add(memberRole);

                verifyCodes.delete(interaction.user.id);

                return interaction.update({
                    content: '✅ אומתת בהצלחה! קיבלת גישה לשרת.',
                    embeds: [],
                    components: []
                });
            }

            // =======================
            // Claim Help
            // =======================

            if (!interaction.customId.startsWith('claim_help')) {
                return interaction.reply({
                    content: '❌ כפתור לא מוכר.',
                    ephemeral: true
                });
            }

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.reply({
                    content: '❌ רק צוות ה-Staff יכול לקחת בקשות!',
                    ephemeral: true
                });
            }

            await interaction.deferUpdate();

            const currentButton =
                interaction.message.components[0]?.components[0];

            if (currentButton?.disabled === true) {
                return;
            }

            const claimedButton = new ButtonBuilder()
                .setCustomId('claimed_help')
                .setLabel(`Claimed by ${interaction.user.username}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const row = new ActionRowBuilder()
                .addComponents(claimedButton);

            await interaction.message.edit({
                components: [row]
            });

            const logsChannel =
                interaction.guild.channels.cache.get(logsChannelId);

            if (logsChannel) {
                logsChannel.send(
`✅ בקשת Help נלקחה

👤 נלקח על ידי: <@${interaction.user.id}>
🆔 Message ID: ${interaction.message.id}`
                ).catch(() => {});
            }

            return;
        }

    } catch (error) {
        console.error('❌ Interaction Error:', error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ הייתה שגיאה באינטראקציה.',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// =======================
// Login
// =======================

client.login(process.env.DISCORD_TOKEN);
