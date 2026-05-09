const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')

        .addStringOption(option =>
            option
                .setName('userid')
                .setDescription('ה-ID של המשתמש להוריד לו באן')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה להורדת הבאן')
                .setRequired(false)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        try {

            const staffRoleId = "1502608350364565695";
            const logsChannelId = "1502608488939917362";

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.editReply("❌ אין לך הרשאה להשתמש בפקודה הזאת");
            }

            const userId = interaction.options.getString('userid');
            const reason = interaction.options.getString('reason') || "אין סיבה";

            const banInfo = await interaction.guild.bans.fetch(userId).catch(() => null);

            if (!banInfo) {
                return interaction.editReply("❌ המשתמש הזה לא בבאן או שה-ID לא נכון.");
            }

            await interaction.guild.members.unban(userId, reason);

            const now = new Date();

            const unbanEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ Member Unbanned")
                .addFields(
                    {
                        name: "Moderator",
                        value: `<@${interaction.user.id}> (${interaction.user.username})`
                    },
                    {
                        name: "Member",
                        value: `<@${banInfo.user.id}> (${banInfo.user.username})`
                    },
                    {
                        name: "Reason",
                        value: reason
                    },
                    {
                        name: "Unban Time",
                        value: now.toLocaleString()
                    }
                )
                .setFooter({
                    text: `Moderation System • ${now.toLocaleString()}`
                });

            const logsChannel = interaction.guild.channels.cache.get(logsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [unbanEmbed]
                });
            }

            try {
                await banInfo.user.send({
                    embeds: [unbanEmbed]
                });
            } catch {}

            await interaction.editReply({
                embeds: [unbanEmbed]
            });

        } catch (error) {

            console.error("Unban command error:", error);

            await interaction.editReply({
                content: "❌ לא הצלחתי להוריד באן. בדוק שלבוט יש הרשאת Ban Members."
            }).catch(() => {});

        }

    }

};
