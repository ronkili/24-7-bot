const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function parseTime(time) {
    const match = time.toLowerCase().match(/^(\d+)(s|m|h)$/);

    if (!match) return null;

    const amount = parseInt(match[1]);
    const unit = match[2];

    if (amount <= 0) return null;

    if (unit === "s") return amount * 1000;
    if (unit === "m") return amount * 60 * 1000;
    if (unit === "h") return amount * 60 * 60 * 1000;

    return null;
}

module.exports = {

    data: new SlashCommandBuilder()
        .setName('voicemute')
        .setDescription('Mute a member in voice')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש למיוט')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('time')
                .setDescription('זמן למיוט (10s / 10m / 1h)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה למיוט')
                .setRequired(false)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        try {

            const staffRoleId = "1503005836623085691";
            const logsChannelId = "1509932341840314519";

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.editReply({
                    content: "❌ אין לך הרשאה"
                });
            }

            const member = interaction.options.getMember('user');
            const timeArg = interaction.options.getString('time');
            const reason = interaction.options.getString('reason') || "אין סיבה";

            if (!member) {
                return interaction.editReply({
                    content: "❌ לא מצאתי את המשתמש"
                });
            }

            if (!member.voice.channel) {
                return interaction.editReply({
                    content: "❌ המשתמש לא נמצא ב-Voice"
                });
            }

            const duration = parseTime(timeArg);

            if (!duration) {
                return interaction.editReply({
                    content: "❌ זמן לא תקין. דוגמאות: `10s`, `10m`, `1h`"
                });
            }

            await member.voice.setMute(true, reason);

            const now = new Date();
            const endTime = new Date(Date.now() + duration);

            const muteEmbed = new EmbedBuilder()
                .setColor("Red")
                .setTitle("⚠️ Member Voice Muted")
                .addFields(
                    {
                        name: "Moderator",
                        value: `<@${interaction.user.id}> (${interaction.user.username})`
                    },
                    {
                        name: "Member",
                        value: `<@${member.id}> (${member.user.username})`
                    },
                    {
                        name: "Reason",
                        value: reason
                    },
                    {
                        name: "Mute Time",
                        value: now.toLocaleString()
                    },
                    {
                        name: "Duration",
                        value: timeArg
                    },
                    {
                        name: "Ends At",
                        value: endTime.toLocaleString()
                    }
                )
                .setFooter({
                    text: `Moderation System • ${now.toLocaleString()}`
                });

            const logsChannel = interaction.guild.channels.cache.get(logsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [muteEmbed]
                });
            }

            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor("Red")
                    .setTitle("🔇 קיבלת Voice Mute")
                    .addFields(
                        {
                            name: "שרת",
                            value: interaction.guild.name
                        },
                        {
                            name: "Moderator",
                            value: `<@${interaction.user.id}> (${interaction.user.username})`
                        },
                        {
                            name: "Reason",
                            value: reason
                        },
                        {
                            name: "Duration",
                            value: timeArg
                        },
                        {
                            name: "Ends At",
                            value: endTime.toLocaleString()
                        }
                    )
                    .setFooter({
                        text: "Night Vibes Moderation System"
                    });

                await member.send({
                    embeds: [dmEmbed]
                });

            } catch {
                console.log("❌ לא ניתן לשלוח DM למשתמש");
            }

            await interaction.editReply({
                embeds: [muteEmbed]
            });

            setTimeout(async () => {

                try {

                    const guild = interaction.client.guilds.cache.get(interaction.guild.id);
                    if (!guild) return;

                    const freshMember = await guild.members.fetch(member.id).catch(() => null);
                    if (!freshMember) return;

                    if (!freshMember.voice.channel) {
                        console.log(`ℹ️ ${freshMember.user.tag} לא נמצא ב-Voice בזמן הורדת המיוט`);
                        return;
                    }

                    await freshMember.voice.setMute(false, "Voice mute time ended");

                    const unmuteEmbed = new EmbedBuilder()
                        .setColor("Green")
                        .setTitle("🔊 Member Voice Unmuted")
                        .addFields(
                            {
                                name: "Member",
                                value: `<@${freshMember.id}> (${freshMember.user.username})`
                            },
                            {
                                name: "Reason",
                                value: "Mute time ended"
                            },
                            {
                                name: "Time",
                                value: new Date().toLocaleString()
                            }
                        )
                        .setFooter({
                            text: "Moderation System"
                        });

                    if (logsChannel && logsChannel.isTextBased()) {
                        await logsChannel.send({
                            embeds: [unmuteEmbed]
                        });
                    }

                    try {
                        await freshMember.send({
                            content: `🔊 ה-Voice Mute שלך בשרת **${interaction.guild.name}** נגמר.`
                        });
                    } catch {}

                } catch (error) {
                    console.log("❌ Failed to auto unmute:", error);
                }

            }, duration);

        } catch (error) {

            console.log(error);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "❌ הייתה שגיאה בפקודה"
                }).catch(() => {});
            } else {
                await interaction.reply({
                    content: "❌ הייתה שגיאה בפקודה",
                    ephemeral: true
                }).catch(() => {});
            }

        }

    }

};
