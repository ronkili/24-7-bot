const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicedeafen')
        .setDescription('מחריש משתמש בחדר קולי לזמן מוגדר עם סיבה')

        .addUserOption(option =>
            option.setName('user')
                .setDescription('בחר את המשתמש')
                .setRequired(true)
        )

        .addStringOption(option =>
            option.setName('time')
                .setDescription('זמן לדוגמה: 10s, 5m, 1h')
                .setRequired(true)
        )

        // ⭐ סיבה
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('סיבה להחרשה')
                .setRequired(true)
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),

    async execute(interaction) {
        try {

            const targetUser = await interaction.guild.members.fetch(
                interaction.options.getUser('user').id
            );

            const time = interaction.options.getString('time');
            const reason = interaction.options.getString('reason');

            const botMember = interaction.guild.members.me;

            // בדיקת היררכיית רולים
            if (botMember.roles.highest.position <= targetUser.roles.highest.position) {
                return interaction.reply({
                    content: '❌ אני לא יכול להחריש משתמש עם רול גבוה או שווה לשלי.',
                    ephemeral: true
                });
            }

            // בדיקה אם המשתמש ב־VC
            if (!targetUser.voice.channel) {
                return interaction.reply({
                    content: '❌ המשתמש חייב להיות מחובר לחדר קולי.',
                    ephemeral: true
                });
            }

            // פונקציה לפענוח זמן
            function parseTime(time) {
                const amount = parseInt(time);
                const unit = time.slice(-1).toLowerCase();

                if (unit === 's') return amount * 1000;
                if (unit === 'm') return amount * 60 * 1000;
                if (unit === 'h') return amount * 60 * 60 * 1000;

                return null;
            }

            const duration = parseTime(time);

            if (!duration) {
                return interaction.reply({
                    content: '❌ זמן לא תקין! השתמש ב־10s / 5m / 1h',
                    ephemeral: true
                });
            }

            // מבצע Deafen
            await targetUser.voice.setDeaf(true, reason);

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔇 Voice Deafen')
                .addFields(
                    { name: '👤 משתמש', value: `${targetUser.user.tag}` },
                    { name: '⏱️ זמן', value: time },
                    { name: '📄 סיבה', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // ביטול Deafen אחרי הזמן
            setTimeout(async () => {
                try {
                    if (targetUser.voice.channel) {
                        await targetUser.voice.setDeaf(false);
                    }
                } catch (err) {
                    console.error(err);
                }
            }, duration);

        } catch (error) {
            console.error(error);

            return interaction.reply({
                content: '❌ אירעה שגיאה בהפעלת הפקודה.',
                ephemeral: true
            });
        }
    }
};
