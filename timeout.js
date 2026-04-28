const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('נותן מיוט (השתקה) זמני למשתמש')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('המשתמש שתרצה להשתיק')
                .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('duration')
                .setDescription('זמן ההשתקה בדקות')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320) // מקסימום 28 ימים
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('סיבת ההשתקה (אופציונלי)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers), // הרשאה למודרטורים
        
    async execute(interaction) {
        const targetUser = interaction.options.getMember('user');
        const durationMins = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'לא צוינה סיבה';

        if (!targetUser) {
            return interaction.reply({ content: '❌ לא הצלחתי למצוא את המשתמש בשרת.', ephemeral: true });
        }

        // המרה מדקות לאלפיות שנייה (מילישניות)
        const durationMs = durationMins * 60 * 1000;

        try {
            await targetUser.timeout(durationMs, reason);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🤐 משתמש הושתק!')
                .setDescription(`**${targetUser.user.tag}** קיבל מיוט ל-${durationMins} דקות.\n**סיבה:** ${reason}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ שגיאה: אין לי הרשאות להשתיק את המשתמש הזה (אולי הוא מעליי בדרגה?).', ephemeral: true });
        }
    }
};