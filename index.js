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
const { createCanvas, loadImage } = require('canvas');

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
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// =======================
// IDs
// =======================

const helpChannelId = "1504145974660956292"; 
const staffRoleId = "1504145863797117170";
const ticketStaffRoleId = "1504145860504719367";
const logsChannelId = "1504145959238500454";
const memberRoleId = "1504145856033587200";
const ticketLogsChannelId = "1504145958278135868";
const ticketCategoryId = "1504145950351036490";
const welcomeChannelId = "1504145965089558609";

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
// Welcome Helper
// =======================

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// =======================
// Welcome System
// =======================

client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);

        if (!welcomeChannel || !welcomeChannel.isTextBased()) return;

        const canvas = createCanvas(1000, 500);
        const ctx = canvas.getContext('2d');

        let backgroundUrl =
            member.guild.bannerURL({ extension: 'png', size: 1024 }) ||
            member.guild.iconURL({ extension: 'png', size: 1024 });

        if (backgroundUrl) {
            const background = await loadImage(backgroundUrl);
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 7;
        roundRect(ctx, 35, 40, 930, 420, 38);
        ctx.stroke();

        // Purple ellipse
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(510, 250, 410, 165, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Avatar
        const avatar = await loadImage(
            member.user.displayAvatarURL({ extension: 'png', size: 256 })
        );

        ctx.save();
        ctx.beginPath();
        ctx.arc(235, 250, 82, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 153, 168, 164, 164);
        ctx.restore();

        // Avatar border
        ctx.beginPath();
        ctx.arc(235, 250, 86, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        ctx.font = '38px Arial';
        ctx.fillText('WELCOME', 570, 185);

        ctx.font = 'bold 62px Arial';
        ctx.fillText(member.user.username.toUpperCase().slice(0, 18), 570, 265);

        ctx.font = '28px Arial';
        ctx.fillText(`${member.guild.name}`, 570, 320);

        ctx.font = '24px Arial';
        ctx.fillText(`Member #${member.guild.memberCount}`, 570, 360);

        const joinedDate = new Date().toLocaleDateString('en-GB');

        ctx.font = '22px Arial';
        ctx.fillText(`Date: ${joinedDate}`, 570, 395);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), {
            name: 'welcome.png'
        });

        await welcomeChannel.send({
            content:
`👋 Welcome <@${member.id}> to **${member.guild.name}**!

📅 Date: **${joinedDate}**
👤 You are member **#${member.guild.memberCount}**`,
            files: [attachment]
        });

    } catch (error) {
        console.error('❌ Welcome Error:', error);
    }
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
            content: '❌ זה לא ערוץ טיקט.',
            ephemeral: true
        });
    }

    if (!isTicketStaff(interaction.member)) {
        return interaction.reply({
            content: '❌ רק Staff Tester יכולים לסגור טיקטים.',
            ephemeral: true
        });
    }

    const ownerId = getTicketOwnerId(channel);
    const logsChannel = interaction.guild.channels.cache.get(ticketLogsChannelId);

    await interaction.reply({
        content: '🔒 סוגר את הטיקט ושולח Transcript...',
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
`📁 **Ticket Closed**

🎫 טיקט: ${channel.name}
👤 נסגר על ידי: <@${interaction.user.id}>
📝 סיבה: ${reason}
👥 פותח הטיקט: ${ownerId ? `<@${ownerId}>` : 'לא נמצא'}`,
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
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_2`)
                        .setLabel('2')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_3`)
                        .setLabel('3')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_4`)
                        .setLabel('4')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_rating_${interaction.guild.id}_5`)
                        .setLabel('5')
                        .setEmoji('⭐')
                        .setStyle(ButtonStyle.Secondary)
                );

            await user.send({
                content:
`⭐ הטיקט שלך בשרת **${interaction.guild.name}** נסגר.

📝 סיבה:
${reason}

איך הייתה החוויה שלך?`,
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
// כל 5 דקות מי שבשיחה מקבל 15 XP
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
`🎉 **עלית Level!**

⭐ הרמה החדשה שלך: **${result.user.level}**
✨ XP נוכחי: **${displayXp}**`
                        );
                    } catch {
                        console.log('לא הצלחתי לשלוח DM על Level Up מ-Voice XP');
                    }
                }
            });
        });
    } catch (error) {
        console.error('❌ Voice XP Error:', error);
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

        if (message.content.toLowerCase().startsWith('!xp')) {
            if (!message.member.roles.cache.has(staffRoleId)) {
                return message.reply('❌ רק Staff יכולים לבדוק XP.');
            }

            const args = message.content.split(' ').slice(1);
            const userId = args[0] || message.author.id;

            let user;

            try {
                user = await client.users.fetch(userId);
            } catch {
                return message.reply('❌ לא מצאתי משתמש עם ה-ID הזה.');
            }

            const userData = getUserData(userId);
            const displayXp = userData.totalXp || userData.xp || 0;

            return message.reply(
`📊 **XP Info**

👤 משתמש: <@${user.id}>
⭐ Level: **${userData.level}**
✨ XP: **${displayXp}**`
            );
        }

        if (message.content.toLowerCase() === '!leaderboard') {
            if (!message.member.roles.cache.has(staffRoleId)) {
                return message.reply('❌ רק Staff יכולים לבדוק Leaderboard.');
            }

            const leaderboard = getLeaderboard();

            if (!leaderboard || leaderboard.length === 0) {
                return message.reply('אין עדיין XP במערכת.');
            }

            let text = '🏆 **XP Leaderboard**\n\n';

            for (let i = 0; i < leaderboard.length; i++) {
                const [userId, data] = leaderboard[i];
                const displayXp = data.totalXp || data.xp || 0;

                text += `**${i + 1}.** <@${userId}> — Level **${data.level}** | XP **${displayXp}**\n`;
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
`🎉 **עלית Level!**

⭐ הרמה החדשה שלך: **${result.user.level}**
✨ XP נוכחי: **${displayXp}**`
                );
            } catch {
                console.log('לא הצלחתי לשלוח DM על Level Up');
            }
        }

    } catch (error) {
        console.error('❌ Message Error:', error);
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
`⭐ **Ticket Rating**

👤 משתמש: <@${interaction.user.id}>
⭐ דירוג: **${rating}/5**`
                ).catch(() => {});
            }

            return interaction.update({
                content: `✅ תודה על הדירוג שלך! דירגת **${rating}/5** ⭐`,
                components: []
            });
        }

        // =======================
        // Modals
        // =======================

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'close_ticket_modal') {
                const reason = interaction.fields.getTextInputValue('close_reason');

                await closeTicket(interaction, reason);
                return;
            }

            if (interaction.customId === 'ticket_other_modal') {
                const reason = interaction.fields.getTextInputValue('ticket_other_reason');

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
                    .replace(/[^a-z0-9א-ת]/g, '-')
                    .slice(0, 20);

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${safeName}`,
                    type: ChannelType.GuildText,
                    parent: ticketCategoryId,
                    topic: `ticketOwner:${interaction.user.id} | ticketType:אחר`,
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
                    .setEmoji('🙋')
                    .setStyle(ButtonStyle.Success);

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(claimTicketButton, closeButton);

                await ticketChannel.send({
                    content:
`❓ **טיקט חדש נפתח**

👤 משתמש: <@${interaction.user.id}>
📌 סוג טיקט: **אחר**

📝 סיבה:
${reason}

<@&${ticketStaffRoleId}>`,
                    components: [row]
                });

                return interaction.reply({
                    content: `✅ הטיקט שלך נפתח: ${ticketChannel}`,
                    ephemeral: true
                });
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
            // VERIFY
            // =======================

            if (interaction.customId === 'start_verify') {
                if (interaction.member.roles.cache.has(memberRoleId)) {
                    return interaction.reply({
                        content: '✅ אתה כבר מאומת.',
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

                const memberRole = interaction.guild.roles.cache.get(memberRoleId);

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
                    components: []
                });
            }

            // =======================
            // XP SHOP
            // =======================

            if (interaction.customId.startsWith('xp_shop_buy_')) {
                const itemId = interaction.customId.replace('xp_shop_buy_', '');
                const item = shopItems.find(i => i.id === itemId);

                if (!item) {
                    return interaction.reply({
                        content: '❌ הפריט לא נמצא בחנות.',
                        ephemeral: true
                    });
                }

                const role = interaction.guild.roles.cache.get(item.roleId);

                if (!role) {
                    return interaction.reply({
                        content: '❌ הרול לא נמצא. בדוק את ה-roleId ב-xpSystem.js.',
                        ephemeral: true
                    });
                }

                if (interaction.member.roles.cache.has(item.roleId)) {
                    return interaction.reply({
                        content: '❌ כבר יש לך את הרול הזה.',
                        ephemeral: true
                    });
                }

                const userData = getUserData(interaction.user.id);
                const userXp = userData.totalXp || userData.xp || 0;

                if (userXp < item.price) {
                    return interaction.reply({
                        content: `❌ אין לך מספיק XP.\nיש לך **${userXp} XP**, והרול עולה **${item.price} XP**.`,
                        ephemeral: true
                    });
                }

                const paid = removeXp(interaction.user.id, item.price);

                if (!paid) {
                    return interaction.reply({
                        content: '❌ אין לך מספיק XP.',
                        ephemeral: true
                    });
                }

                await interaction.member.roles.add(role);

                return interaction.reply({
                    content: `✅ קנית את הרול **${item.name}** ב־**${item.price} XP**!`,
                    ephemeral: true
                });
            }

            // =======================
            // OTHER TICKET MODAL
            // =======================

            if (interaction.customId === 'ticket_other') {
                const modal = new ModalBuilder()
                    .setCustomId('ticket_other_modal')
                    .setTitle('פתיחת טיקט אחר');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('ticket_other_reason')
                    .setLabel('מה הסיבה של הטיקט?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('כתוב כאן את הסיבה לפתיחת הטיקט...')
                    .setRequired(true);

                const row = new ActionRowBuilder()
                    .addComponents(reasonInput);

                modal.addComponents(row);

                return interaction.showModal(modal);
            }

            // =======================
            // TICKET BUTTONS
            // =======================

            const ticketTypes = {
                ticket_staff_test: {
                    name: 'בחינה-לצוות',
                    emoji: '❤'
                },
                ticket_complaint: {
                    name: 'להתלונן',
                    emoji: '❗'
                },
                ticket_partner: {
                    name: 'שתפ',
                    emoji: '🤝'
                },
                ticket_help: {
                    name: 'עזרה',
                    emoji: '🙏'
                },
                ticket_other: {
                    name: 'אחר',
                    emoji: '❓'
                }
            };

            if (ticketTypes[interaction.customId]) {
                const ticketData = ticketTypes[interaction.customId];

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
                    .replace(/[^a-z0-9א-ת]/g, '-')
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
                    .setEmoji('🙋')
                    .setStyle(ButtonStyle.Success);

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(claimTicketButton, closeButton);

                await ticketChannel.send({
                    content:
`${ticketData.emoji} **טיקט חדש נפתח**

👤 משתמש: <@${interaction.user.id}>
📌 סוג טיקט: **${ticketData.name}**

<@&${ticketStaffRoleId}>`,
                    components: [row]
                });

                if (interaction.customId === 'ticket_staff_test') {
                    await ticketChannel.send({
                        content:
`📋 **שאלון בחינה לצוות**

**__1: מהו שמך ?

2: מהו גילך ?

3: האם יש לך ניסיון בשרתים? במידה וכן, אשמח שתפרט/י את הדברים הבאים:

• איזה שרת?
• כמה ממברים?
• מה היה הרול הכי גבוה שהגעת אליו בשרת (+ מתוך כמה רולים?)

4: האם יש לך אימות דו שלבי? (2FA)

5: כמה שעות תוכל/י להיות פעיל ביום ?

6: לאיזה רול את/ה מכוון בעתיד ?

7: איך המקצועיות שלך תתבטא בשרת?

8: איך מתבטאת ההתנהלות שלך באופן כללי?

9: האם יש משהו שיכול להפריע להתנהלות היום-יומית שלך בשרת?

10: למה אתה חושב שכדאי לנו לקבל דווקא אותך ולא מישהו אחר לצוות בשרתנו ?__**`
                    });
                }

                return interaction.reply({
                    content: `✅ הטיקט שלך נפתח: ${ticketChannel}`,
                    ephemeral: true
                });
            }

            // =======================
            // CLAIM TICKET
            // =======================

            if (interaction.customId === 'claim_ticket') {
                if (!isTicketStaff(interaction.member)) {
                    return interaction.reply({
                        content: '❌ רק Staff Tester יכולים לקחת טיקטים.',
                        ephemeral: true
                    });
                }

                const claimedButton = new ButtonBuilder()
                    .setCustomId('claimed_ticket')
                    .setLabel(`Claimed by ${interaction.user.username}`)
                    .setEmoji('🙋')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(claimedButton, closeButton);

                await interaction.update({
                    components: [row]
                });

                await interaction.channel.send(
                    `🙋 הטיקט נלקח על ידי <@${interaction.user.id}>`
                ).catch(() => {});

                return;
            }

            // =======================
            // CLOSE TICKET WITH REASON
            // =======================

            if (interaction.customId === 'close_ticket') {
                if (!isTicketStaff(interaction.member)) {
                    return interaction.reply({
                        content: '❌ רק Staff Tester יכולים לסגור טיקטים.',
                        ephemeral: true
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId('close_ticket_modal')
                    .setTitle('Close Ticket');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('close_reason')
                    .setLabel('סיבה לסגירת הטיקט')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('כתוב כאן את הסיבה...')
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
