const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove timeout from a member')

        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש להורדת Timeout')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה להורדת הטיימאאוט')
                .setRequired(false)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        try {

            const staffRoleId = "1496162203147964426";
            const logsChannelId = "1497959735607951430";

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.editReply("❌ אין לך הרשאה להשתמש בפקודה הזאת");
            }

            const member = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') || "אין סיבה";

            if (!member) {
                return interaction.editReply("❌ לא מצאתי את המשתמש הזה בשרת");
            }

            await member.timeout(null, reason);

            const now = new Date();

            const untimeoutEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ Member Timeout Removed")
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
                        name: "Untimeout Time",
                        value: now.toLocaleString()
                    }
                )
                .setFooter({
                    text: `Moderation System • ${now.toLocaleString()}`
                });

            const logsChannel = interaction.guild.channels.cache.get(logsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [untimeoutEmbed]
                });
            }

            try {
                await member.send({
                    embeds: [untimeoutEmbed]
                });
            } catch {}

            await interaction.editReply({
                embeds: [untimeoutEmbed]
            });

        } catch (error) {

            console.error("Untimeout command error:", error);

            await interaction.editReply({
                content: "❌ לא הצלחתי להוריד Timeout. בדוק שהבוט מעל המשתמש ויש לו הרשאות."
            }).catch(() => {});

        }

    }

};
