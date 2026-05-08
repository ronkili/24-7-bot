const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('unkick')
        .setDescription('Send an invite to a kicked user')

        .addStringOption(option =>
            option
                .setName('userid')
                .setDescription('ה-ID של המשתמש')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה להחזרה')
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

            const userId = interaction.options.getString('userid');
            const reason = interaction.options.getString('reason') || "אין סיבה";
            const now = new Date();

            const invite = await interaction.channel.createInvite({
                maxAge: 24 * 60 * 60,
                maxUses: 1,
                unique: true,
                reason: `Unkick invite by ${interaction.user.tag}`
            });

            const user = await interaction.client.users.fetch(userId).catch(() => null);

            if (!user) {
                return interaction.editReply("❌ לא מצאתי משתמש עם ה-ID הזה.");
            }

            const unkickEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ Member (Unkicked)")
                .addFields(
                    {
                        name: "Moderator",
                        value: `<@${interaction.user.id}> (${interaction.user.username})`
                    },
                    {
                        name: "Member",
                        value: `<@${user.id}> (${user.username})`
                    },
                    {
                        name: "Reason",
                        value: reason
                    },
                    {
                        name: "Invite",
                        value: invite.url
                    },
                    {
                        name: "Unkick Time",
                        value: now.toLocaleString()
                    }
                )
                .setFooter({
                    text: `Moderation System • ${now.toLocaleString()}`
                });

            try {
                await user.send({
                    content: `✅ קיבלת הזמנה לחזור לשרת **${interaction.guild.name}**:\n${invite.url}`,
                    embeds: [unkickEmbed]
                });
            } catch {
                return interaction.editReply({
                    content:
`⚠️ לא הצלחתי לשלוח DM למשתמש.

Invite:
${invite.url}`,
                    embeds: [unkickEmbed]
                });
            }

            const logsChannel = interaction.guild.channels.cache.get(logsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [unkickEmbed]
                });
            }

            await interaction.editReply({
                embeds: [unkickEmbed]
            });

        } catch (error) {

            console.error("Unkick command error:", error);

            await interaction.editReply({
                content: "❌ לא הצלחתי לעשות Unkick. בדוק שלבוט יש הרשאת Create Invite."
            }).catch(() => {});

        }

    }

};
