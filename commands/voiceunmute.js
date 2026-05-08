const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('voiceunmute')
        .setDescription('Unmute a member in voice')

        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש להורדת Voice Mute')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה להורדת המיוט')
                .setRequired(false)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        try {

            const staffRoleId = "1496162203147964426";
            const logsChannelId = "1498316795260567612";

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.editReply("❌ אין לך הרשאה להשתמש בפקודה הזאת");
            }

            const member = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') || "אין סיבה";

            if (!member) {
                return interaction.editReply("❌ לא מצאתי את המשתמש הזה בשרת");
            }

            if (!member.voice.channel) {
                return interaction.editReply("❌ המשתמש לא נמצא ב-Voice");
            }

            await member.voice.setMute(false, reason);

            const now = new Date();

            const unmuteEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("🔊 Member Voice Unmuted")
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
                        name: "Unmute Time",
                        value: now.toLocaleString()
                    }
                )
                .setFooter({
                    text: `Moderation System • ${now.toLocaleString()}`
                });

            const logsChannel = interaction.guild.channels.cache.get(logsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [unmuteEmbed]
                });
            }

            try {
                await member.send({
                    embeds: [unmuteEmbed]
                });
            } catch {
                console.log("❌ לא ניתן לשלוח DM למשתמש");
            }

            await interaction.editReply({
                embeds: [unmuteEmbed]
            });

        } catch (error) {

            console.error("VoiceUnmute command error:", error);

            await interaction.editReply({
                content: "❌ הייתה שגיאה בפקודת voiceunmute"
            }).catch(() => {});

        }

    }

};
