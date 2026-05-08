const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Remove a warning from a member')

        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש שמורידים לו Warn')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה להורדת ה-Warn')
                .setRequired(false)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        try {

            const staffRoleId = "1496162203147964426";
            const warnLogsChannelId = "1497959735607951430";

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.editReply("❌ אין לך הרשאה להשתמש בפקודה הזאת");
            }

            const user = interaction.options.getUser('user');
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                return interaction.editReply("❌ לא מצאתי את המשתמש הזה בשרת");
            }

            const reason = interaction.options.getString('reason') || "אין סיבה";
            const now = new Date();

            const unwarnEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ Member (Unwarned)")
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
                        name: "Unwarn Time",
                        value: now.toLocaleString()
                    }
                )
                .setFooter({
                    text: `Moderation System • ${now.toLocaleString()}`
                });

            const logsChannel = interaction.guild.channels.cache.get(warnLogsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [unwarnEmbed]
                });
            }

            try {
                await member.send({
                    embeds: [unwarnEmbed]
                });
            } catch (err) {
                console.log("DM failed:", err.message);
            }

            await interaction.editReply({
                embeds: [unwarnEmbed]
            });

        } catch (error) {

            console.error("Unwarn command error:", error);

            await interaction.editReply({
                content: "❌ הייתה שגיאה בפקודת unwarn"
            }).catch(() => {});

        }

    }

};
