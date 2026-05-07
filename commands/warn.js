const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Give a warning')

        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('סוג האזהרה')
                .setRequired(true)
                .addChoices(
                    { name: 'Voice Mute', value: 'voice_mute' },
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' }
                )
        )

        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה')
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

            const type = interaction.options.getString('type');
            const reason = interaction.options.getString('reason') || "אין סיבה";

            const now = new Date();

            const typeNames = {
                voice_mute: "Voice Mute Warning",
                timeout: "Timeout Warning",
                kick: "Kick Warning",
                ban: "Ban Warning"
            };

            const typeName = typeNames[type] || "Warning";

            const warnEmbed = new EmbedBuilder()
                .setColor("Red")
                .setTitle(`⚠️ ${typeName}`)
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
                        name: "Type",
                        value: typeName
                    },
                    {
                        name: "Reason",
                        value: reason
                    },
                    {
                        name: "Time",
                        value: now.toLocaleString()
                    }
                )
                .setFooter({
                    text: `Moderation System • ${now.toLocaleString()}`
                });

            const logsChannel = interaction.guild.channels.cache.get(warnLogsChannelId);

            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [warnEmbed]
                });
            }

            try {
                await member.send({
                    embeds: [warnEmbed]
                });
            } catch (err) {
                console.log("DM failed:", err.message);
            }

            await interaction.editReply({
                embeds: [warnEmbed]
            });

        } catch (error) {

            console.error("Warn command error:", error);

            await interaction.editReply({
                content: "❌ הייתה שגיאה בפקודת warn"
            }).catch(() => {});

        }

    }

};
