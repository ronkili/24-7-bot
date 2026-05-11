require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    ChannelType,
    PermissionFlagsBits,
    ActivityType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const {
    addXp,
    getUserData,
    getLeaderboard,
    shopItems,
    removeXp
} = require('./utils/xpSystem');

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

const helpChannelId = "1502608513795362856"; 
const staffRoleId = "1502608350364565695";
const ticketStaffRoleId = "1502608354873184286";
const logsChannelId = "1502608484389359617";
const memberRoleId = "1502608358463766559";
const ticketLogsChannelId = "1502608482531016874";
const ticketCategoryId = "1502608433701191802";

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

    console.log("נ“‚ Command files found:", commandFiles);

    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            delete require.cache[require.resolve(filePath)];

            const command = require(filePath);

            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log(`ג… Loaded command: ${command.data.name}`);
            } else {
                console.log(`ג Command file broken: ${file}`);
            }

        } catch (error) {
            console.log(`ג Failed to load command file: ${file}`);
            console.error(error);
        }
    }
} else {
    console.log("ג commands folder not found");
}

// =======================
// Ready
// =======================

client.once('ready', () => {
    console.log(`ג… Logged in as ${client.user.tag}`);
    console.log("ג… RUNNING NEW INDEX WITHOUT HELP_SOURCE");
});

// =======================
// Ticket Helper Functions
// =======================

function isTicketStaff(member) {
    return member.roles.cache.has(ticketStaffRoleId);
}

function getTicketOwnerId(channel) {
    if (!channel.topic) return null;

    const match = channel.topic.match(/ticketOwner:(\d+)/);
    return match ? match[1] : null;
}

async function createTranscript(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });

    const sortedMessages = [...messages.values()].sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    let transcript = `Transcript for #${channel.name}\n`;
    transcript += `Channel ID: ${channel.id}\n`;
    transcript += `Created At: ${new Date().toLocaleString()}\n\n`;

    for (const msg of sortedMessages) {
        transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content || '[No text]'}\n`;

        if (msg.attachments.size > 0) {
            msg.attachments.forEach(attachment => {
                transcript += `Attachment: ${attachment.url}\n`;
            });
        }
    }

    return Buffer.from(transcript, 'utf8');
}

async function closeTicket(interaction, reason) {
    const channel = interaction.channel;

    if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({
            content: 'ג ׳–׳” ׳׳ ׳¢׳¨׳•׳¥ ׳˜׳™׳§׳˜.',
            ephemeral: true
        });
    }

    if (!isTicketStaff(interaction.member)) {
        return interaction.reply({
            content: 'ג ׳¨׳§ Staff Tester ׳™׳›׳•׳׳™׳ ׳׳¡׳’׳•׳¨ ׳˜׳™׳§׳˜׳™׳.',
            ephemeral: true
        });
    }

    const ownerId = getTicketOwnerId(channel);
    const logsChannel = interaction.guild.channels.cache.get(ticketLogsChannelId);

    await interaction.reply({
        content: 'נ”’ ׳¡׳•׳’׳¨ ׳׳× ׳”׳˜׳™׳§׳˜ ׳•׳©׳•׳׳— Transcript...',
        ephemeral: false
    });

    const transcriptBuffer = await createTranscript(channel).catch(() => null);

    if (logsChannel && logsChannel.isTextBased()) {
        const files = [];

        if (transcriptBuffer) {
            files.push(
                new AttachmentBuilder(transcriptBuffer, {
                    name: `${channel.name}-transcript.txt`
                })
            );
        }

        await logsChannel.send({
            content:
`נ“ **Ticket Closed**

נ« ׳˜׳™׳§׳˜: ${channel.name}
נ‘₪ ׳ ׳¡׳’׳¨ ׳¢׳ ׳™׳“׳™: <@${interaction.user.id}>
נ“ ׳¡׳™׳‘׳”: ${reason}
נ‘¥ ׳₪׳•׳×׳— ׳”׳˜׳™׳§׳˜: ${ownerId ? `<@${ownerId}>` : '׳׳ ׳ ׳׳¦׳'}`,
            files
        }).catch(() => {});
    }

    if (ownerId) {
        const user = await client.users.fetch(ownerId).catch(() => null);

        if (user) {
            const ratingRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_1`)
                        .setLabel('1')
                        .setEmoji('ג­')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_2`)
                        .setLabel('2')
                        .setEmoji('ג­')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_3`)
                        .setLabel('3')
                        .setEmoji('ג­')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_4`)
                        .setLabel('4')
                        .setEmoji('ג­')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_5`)
                        .setLabel('5')
                        .setEmoji('ג­')
                        .setStyle(ButtonStyle.Secondary)
                );

            await user.send({
                content:
`ג­ ׳”׳˜׳™׳§׳˜ ׳©׳׳ ׳‘׳©׳¨׳× **${interaction.guild.name}** ׳ ׳¡׳’׳¨.

נ“ ׳¡׳™׳‘׳”:
${reason}

׳׳™׳ ׳”׳™׳™׳×׳” ׳”׳—׳•׳•׳™׳” ׳©׳׳?`,
                components: [ratingRow]
            }).catch(() => {});
        }
    }

    setTimeout(() => {
        channel.delete().catch(() => {});
    }, 5000);
}

// =======================
// Voice XP System
// ׳›׳ 5 ׳“׳§׳•׳× ׳׳™ ׳©׳‘׳©׳™׳—׳” ׳׳§׳‘׳ 15 XP
// =======================

setInterval(async () => {

    try {

        client.guilds.cache.forEach(async (guild) => {

            guild.voiceStates.cache.forEach(async (voiceState) => {

                const member = voiceState.member;

                if (!member) return;
                if (member.user.bot) return;
                if (!voiceState.channel) return;

                const result = addXp(member.id, 15);

                if (result.leveledUp) {
                    try {
                        const displayXp = result.user.totalXp || result.user.xp || 0;

                        await member.send(
`נ‰ **׳¢׳׳™׳× Level!**

ג­ ׳”׳¨׳׳” ׳”׳—׳“׳©׳” ׳©׳׳: **${result.user.level}**
ג¨ XP ׳ ׳•׳›׳—׳™: **${displayXp}**`
                        );
                    } catch {
                        console.log('׳׳ ׳”׳¦׳׳—׳×׳™ ׳׳©׳׳•׳— DM ׳¢׳ Level Up ׳-Voice XP');
                    }
                }

            });

        });

    } catch (error) {
        console.error('ג Voice XP Error:', error);
    }

}, 5 * 60 * 1000);

// =======================
// Message Handler
// Help + XP
// =======================

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;
        if (!message.guild) return;

        if (message.content.toLowerCase().startsWith('!h')) {

            if (handledMessages.has(message.id)) return;
            handledMessages.add(message.id);

            setTimeout(() => {
                handledMessages.delete(message.id);
            }, 60 * 1000);

            const helpChannel = message.guild.channels.cache.get(helpChannelId);
            const logsChannel = message.guild.channels.cache.get(logsChannelId);

            if (!helpChannel) {
                return message.reply('ג ׳׳ ׳ ׳׳¦׳ ׳¢׳¨׳•׳¥ help');
            }

            if (helpCooldown.has(message.author.id)) {
                const expirationTime =
                    helpCooldown.get(message.author.id) + helpCooldownTime;

                if (Date.now() < expirationTime) {
                    const timeLeft =
                        ((expirationTime - Date.now()) / 1000).toFixed(1);

                    return message.reply(
                        `ג±ן¸ ׳—׳›׳” ${timeLeft} ׳©׳ ׳™׳•׳× ׳׳₪׳ ׳™ ׳©׳׳×׳” ׳¢׳•׳©׳” !h ׳©׳•׳‘`
                    );
                }
            }

            helpCooldown.set(message.author.id, Date.now());

            setTimeout(() => {
                helpCooldown.delete(message.author.id);
            }, helpCooldownTime);

            let reason = message.content.slice(2).trim();

            if (!reason) {
                reason = "׳׳™׳ ׳¡׳™׳‘׳”";
            }

            const claimButton = new ButtonBuilder()
                .setCustomId(`claim_help_${message.id}`)
                .setLabel('Claim')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(claimButton);

            const sentMessage = await helpChannel.send({
                content:
`נ“© **׳‘׳§׳©׳× ׳¢׳–׳¨׳” ׳—׳“׳©׳”**

נ‘₪ ׳׳©׳×׳׳©: <@${message.author.id}>
נ“ ׳¡׳™׳‘׳”: ${reason}

<@&${staffRoleId}>`,
                components: [row]
            });

            if (logsChannel) {
                logsChannel.send(
`נ“© ׳‘׳§׳©׳× Help ׳—׳“׳©׳”

נ‘₪ ׳׳©׳×׳׳©: <@${message.author.id}>
נ“ ׳¡׳™׳‘׳”: ${reason}
נ†” Message ID: ${sentMessage.id}`
                ).catch(() => {});
            }

            try {
                await message.author.send(
`נ“© ׳‘׳§׳©׳× ׳”׳¢׳–׳¨׳” ׳©׳׳ ׳ ׳©׳׳—׳” ׳׳¦׳•׳•׳×!

נ“ ׳¡׳™׳‘׳”:
${reason}`
                );
            } catch {}

            return;
        }

        if (message.content.toLowerCase().startsWith('!xp')) {

            if (!message.member.roles.cache.has(staffRoleId)) {
                return message.reply('ג ׳¨׳§ Staff ׳™׳›׳•׳׳™׳ ׳׳‘׳“׳•׳§ XP.');
            }

            const args = message.content.split(' ').slice(1);
            const userId = args[0] || message.author.id;

            let user;

            try {
                user = await client.users.fetch(userId);
            } catch {
                return message.reply('ג ׳׳ ׳׳¦׳׳×׳™ ׳׳©׳×׳׳© ׳¢׳ ׳”-ID ׳”׳–׳”.');
            }

            const userData = getUserData(userId);
            const displayXp = userData.totalXp || userData.xp || 0;

            return message.reply(
`נ“ **XP Info**

נ‘₪ ׳׳©׳×׳׳©: <@${user.id}>
ג­ Level: **${userData.level}**
ג¨ XP: **${displayXp}**`
            );
        }

        if (message.content.toLowerCase() === '!leaderboard') {

            if (!message.member.roles.cache.has(staffRoleId)) {
                return message.reply('ג ׳¨׳§ Staff ׳™׳›׳•׳׳™׳ ׳׳‘׳“׳•׳§ Leaderboard.');
            }

            const leaderboard = getLeaderboard();

            if (!leaderboard || leaderboard.length === 0) {
                return message.reply('׳׳™׳ ׳¢׳“׳™׳™׳ XP ׳‘׳׳¢׳¨׳›׳×.');
            }

            let text = 'נ† **XP Leaderboard**\n\n';

            for (let i = 0; i < leaderboard.length; i++) {
                const [userId, data] = leaderboard[i];
                const displayXp = data.totalXp || data.xp || 0;

                text += `**${i + 1}.** <@${userId}> ג€” Level **${data.level}** | XP **${displayXp}**\n`;
            }

            return message.reply(text);
        }

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
            try {
                const displayXp = result.user.totalXp || result.user.xp || 0;

                await message.author.send(
`נ‰ **׳¢׳׳™׳× Level!**

ג­ ׳”׳¨׳׳” ׳”׳—׳“׳©׳” ׳©׳׳: **${result.user.level}**
ג¨ XP ׳ ׳•׳›׳—׳™: **${displayXp}**`
                );
            } catch {
                console.log('׳׳ ׳”׳¦׳׳—׳×׳™ ׳׳©׳׳•׳— DM ׳¢׳ Level Up');
            }
        }

    } catch (error) {
        console.error('ג Message Error:', error);
    }
});

// =======================
// Interaction Handler
// Slash Commands + Verify + Tickets + Claim + XP Shop
// =======================

client.on('interactionCreate', async (interaction) => {
    try {

        // =======================
        // Rating Button
        // =======================

        if (interaction.isButton() && interaction.customId.startsWith('ticket_rating_')) {
            const parts = interaction.customId.split('_');
            const guildId = parts[2];
            const rating = parts[3];

            const guild = client.guilds.cache.get(guildId);
            const logsChannel = guild?.channels.cache.get(ticketLogsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send(
`ג­ **Ticket Rating**

נ‘₪ ׳׳©׳×׳׳©: <@${interaction.user.id}>
ג­ ׳“׳™׳¨׳•׳’: **${rating}/5**`
                ).catch(() => {});
            }

            return interaction.update({
                content: `ג… ׳×׳•׳“׳” ׳¢׳ ׳”׳“׳™׳¨׳•׳’ ׳©׳׳! ׳“׳™׳¨׳’׳× **${rating}/5** ג­`,
                components: []
            });
        }

        // =======================
        // Close Ticket Modal
        // =======================

        if (interaction.isModalSubmit()) {

            if (interaction.customId === 'close_ticket_modal') {
                const reason = interaction.fields.getTextInputValue('close_reason');

                await closeTicket(interaction, reason);
                return;
            }

        }

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
                            console.log(`ג… Loaded command on demand: ${command.data.name}`);
                        }
                    } catch (error) {
                        console.error(`ג Failed to load command on demand: ${interaction.commandName}`, error);
                    }
                }
            }

            if (!command) {
                return interaction.reply({
                    content: 'ג ׳”׳₪׳§׳•׳“׳” ׳׳ ׳ ׳׳¦׳׳” ׳‘׳‘׳•׳˜.',
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

            if (interaction.customId === 'start_verify') {

                if (interaction.member.roles.cache.has(memberRoleId)) {
                    return interaction.reply({
                        content: 'ג… ׳׳×׳” ׳›׳‘׳¨ ׳׳׳•׳׳×.',
                        ephemeral: true
                    });
                }

                const correctCode = Math.floor(1000 + Math.random() * 9000).toString();

                let codes = [correctCode];

                while (codes.length < 4) {
                    const fakeCode = Math.floor(1000 + Math.random() * 9000).toString();

                    if (!codes.includes(fakeCode)) {
                        codes.push(fakeCode);
                    }
                }

                codes = codes.sort(() => Math.random() - 0.5);

                verifyCodes.set(interaction.user.id, correctCode);

                setTimeout(() => {
                    verifyCodes.delete(interaction.user.id);
                }, 2 * 60 * 1000);

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
                    content: `Your Verification Code Is: **${correctCode}**`,
                    components: [row],
                    ephemeral: true
                });
            }

            if (interaction.customId.startsWith('verify_answer_')) {

                const selectedCode = interaction.customId.replace('verify_answer_', '');
                const correctCode = verifyCodes.get(interaction.user.id);

                if (!correctCode) {
                    return interaction.reply({
                        content: 'ג ׳׳™׳ ׳׳ ׳׳™׳׳•׳× ׳₪׳¢׳™׳. ׳׳—׳¥ ׳©׳•׳‘ ׳¢׳ Verify.',
                        ephemeral: true
                    });
                }

                if (selectedCode !== correctCode) {
                    return interaction.reply({
                        content: 'ג ׳§׳•׳“ ׳©׳’׳•׳™. ׳ ׳¡׳” ׳©׳•׳‘.',
                        ephemeral: true
                    });
                }

                const memberRole = interaction.guild.roles.cache.get(memberRoleId);

                if (!memberRole) {
                    return interaction.reply({
                        content: 'ג ׳¨׳•׳ Member ׳׳ ׳ ׳׳¦׳.',
                        ephemeral: true
                    });
                }

                await interaction.member.roles.add(memberRole);

                verifyCodes.delete(interaction.user.id);

                return interaction.update({
                    content: 'ג… ׳׳•׳׳×׳× ׳‘׳”׳¦׳׳—׳”! ׳§׳™׳‘׳׳× ׳’׳™׳©׳” ׳׳©׳¨׳×.',
                    components: []
                });
            }

            if (interaction.customId.startsWith('xp_shop_buy_')) {

                const itemId = interaction.customId.replace('xp_shop_buy_', '');
                const item = shopItems.find(i => i.id === itemId);

                if (!item) {
                    return interaction.reply({
                        content: 'ג ׳”׳₪׳¨׳™׳˜ ׳׳ ׳ ׳׳¦׳ ׳‘׳—׳ ׳•׳×.',
                        ephemeral: true
                    });
                }

                const role = interaction.guild.roles.cache.get(item.roleId);

                if (!role) {
                    return interaction.reply({
                        content: 'ג ׳”׳¨׳•׳ ׳׳ ׳ ׳׳¦׳. ׳‘׳“׳•׳§ ׳׳× ׳”-roleId ׳‘-xpSystem.js.',
                        ephemeral: true
                    });
                }

                if (interaction.member.roles.cache.has(item.roleId)) {
                    return interaction.reply({
                        content: 'ג ׳›׳‘׳¨ ׳™׳© ׳׳ ׳׳× ׳”׳¨׳•׳ ׳”׳–׳”.',
                        ephemeral: true
                    });
                }

                const userData = getUserData(interaction.user.id);
                const userXp = userData.totalXp || userData.xp || 0;

                if (userXp < item.price) {
                    return interaction.reply({
                        content: `ג ׳׳™׳ ׳׳ ׳׳¡׳₪׳™׳§ XP.\n׳™׳© ׳׳ **${userXp} XP**, ׳•׳”׳¨׳•׳ ׳¢׳•׳׳” **${item.price} XP**.`,
                        ephemeral: true
                    });
                }

                const paid = removeXp(interaction.user.id, item.price);

                if (!paid) {
                    return interaction.reply({
                        content: 'ג ׳׳™׳ ׳׳ ׳׳¡׳₪׳™׳§ XP.',
                        ephemeral: true
                    });
                }

                await interaction.member.roles.add(role);

                return interaction.reply({
                    content: `ג… ׳§׳ ׳™׳× ׳׳× ׳”׳¨׳•׳ **${item.name}** ׳‘ײ¾**${item.price} XP**!`,
                    ephemeral: true
                });
            }

            // =======================
            // TICKET BUTTONS
            // =======================

            const ticketTypes = {
                ticket_staff_test: {
                    name: '׳‘׳—׳™׳ ׳”-׳׳¦׳•׳•׳×',
                    emoji: 'ג₪'
                },
                ticket_complaint: {
                    name: '׳׳”׳×׳׳•׳ ׳',
                    emoji: 'ג—'
                },
                ticket_partner: {
                    name: '׳©׳×׳₪',
                    emoji: 'נ₪'
                },
                ticket_help: {
                    name: '׳¢׳–׳¨׳”',
                    emoji: 'נ™'
                },
                ticket_other: {
                    name: '׳׳—׳¨',
                    emoji: 'ג“'
                }
            };

            if (ticketTypes[interaction.customId]) {

                const ticketData = ticketTypes[interaction.customId];

                const existingChannel = interaction.guild.channels.cache.find(channel =>
                    channel.topic?.includes(`ticketOwner:${interaction.user.id}`)
                );

                if (existingChannel) {
                    return interaction.reply({
                        content: `ג ׳›׳‘׳¨ ׳™׳© ׳׳ ׳˜׳™׳§׳˜ ׳₪׳×׳•׳—: ${existingChannel}`,
                        ephemeral: true
                    });
                }

                const safeName = interaction.user.username
                    .toLowerCase()
                    .replace(/[^a-z0-9׳-׳×]/g, '-')
                    .slice(0, 20);

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${safeName}`,
                    type: ChannelType.GuildText,
                    parent: ticketCategoryId,
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
                            id: ticketStaffRoleId,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.ManageMessages
                            ]
                        }
                    ]
                });

                const claimTicketButton = new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claim Ticket')
                    .setEmoji('נ™‹')
                    .setStyle(ButtonStyle.Success);

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setEmoji('נ”’')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(claimTicketButton, closeButton);

                await ticketChannel.send({
                    content:
`${ticketData.emoji} **׳˜׳™׳§׳˜ ׳—׳“׳© ׳ ׳₪׳×׳—**

נ‘₪ ׳׳©׳×׳׳©: <@${interaction.user.id}>
נ“ ׳¡׳•׳’ ׳˜׳™׳§׳˜: **${ticketData.name}**

<@&${ticketStaffRoleId}>`,
                    components: [row]
                });

                return interaction.reply({
                    content: `ג… ׳”׳˜׳™׳§׳˜ ׳©׳׳ ׳ ׳₪׳×׳—: ${ticketChannel}`,
                    ephemeral: true
                });
            }

            // =======================
            // CLAIM TICKET
            // =======================

            if (interaction.customId === 'claim_ticket') {

                if (!isTicketStaff(interaction.member)) {
                    return interaction.reply({
                        content: 'ג ׳¨׳§ Staff Tester ׳™׳›׳•׳׳™׳ ׳׳§׳—׳× ׳˜׳™׳§׳˜׳™׳.',
                        ephemeral: true
                    });
                }

                const claimedButton = new ButtonBuilder()
                    .setCustomId('claimed_ticket')
                    .setLabel(`Claimed by ${interaction.user.username}`)
                    .setEmoji('נ™‹')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setEmoji('נ”’')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(claimedButton, closeButton);

                await interaction.update({
                    components: [row]
                });

                await interaction.channel.send(
`נ™‹ ׳”׳˜׳™׳§׳˜ ׳ ׳׳§׳— ׳¢׳ ׳™׳“׳™ <@${interaction.user.id}>`
                ).catch(() => {});

                return;
            }

            // =======================
            // CLOSE TICKET WITH REASON
            // =======================

            if (interaction.customId === 'close_ticket') {

                if (!isTicketStaff(interaction.member)) {
                    return interaction.reply({
                        content: 'ג ׳¨׳§ Staff Tester ׳™׳›׳•׳׳™׳ ׳׳¡׳’׳•׳¨ ׳˜׳™׳§׳˜׳™׳.',
                        ephemeral: true
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId('close_ticket_modal')
                    .setTitle('Close Ticket');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('close_reason')
                    .setLabel('׳¡׳™׳‘׳” ׳׳¡׳’׳™׳¨׳× ׳”׳˜׳™׳§׳˜')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('׳›׳×׳•׳‘ ׳›׳׳ ׳׳× ׳”׳¡׳™׳‘׳”...')
                    .setRequired(true);

                const row = new ActionRowBuilder()
                    .addComponents(reasonInput);

                modal.addComponents(row);

                return interaction.showModal(modal);
            }

            // =======================
            // CLAIM HELP BUTTONS
            // =======================

            if (!interaction.customId.startsWith('claim_help')) {
                return interaction.reply({
                    content: 'ג ׳›׳₪׳×׳•׳¨ ׳׳ ׳׳•׳›׳¨.',
                    ephemeral: true
                });
            }

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.reply({
                    content: 'ג ׳¨׳§ ׳¦׳•׳•׳× ׳”-Staff ׳™׳›׳•׳ ׳׳§׳—׳× ׳‘׳§׳©׳•׳×!',
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
`ג… ׳‘׳§׳©׳× Help ׳ ׳׳§׳—׳”

נ‘₪ ׳ ׳׳§׳— ׳¢׳ ׳™׳“׳™: <@${interaction.user.id}>
נ†” Message ID: ${interaction.message.id}`
                ).catch(() => {});
            }

            return;
        }

    } catch (error) {
        console.error('ג Interaction Error:', error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'ג ׳”׳™׳™׳×׳” ׳©׳’׳™׳׳” ׳‘׳׳™׳ ׳˜׳¨׳׳§׳¦׳™׳”.',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// =======================
// Login
// =======================

client.login(process.env.DISCORD_TOKEN);
