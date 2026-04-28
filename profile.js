const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
    // הגדרת הפקודה בלי אפשרות לבחור משתמש אחר
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('מציג את הפרופיל האישי שלך (רמה, כסף, והתקדמות במשימות)'),
        
    async execute(interaction) {
        const targetUser = interaction.user;

        // שליפת הנתונים מהמסד
        let userProfile = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id });

        // אם אין לו עדיין פרופיל (לא שלח הודעות מעולם)
        if (!userProfile) {
            return interaction.reply({ 
                content: 'עדיין אין לך פרופיל בשרת. שלח/י לפחות הודעה אחת בצ\'אט כדי שהמערכת תתחיל לספור!', 
                ephemeral: true // הודעה פרטית
            });
        }

        const xpNeeded = userProfile.level * 100;

        // עיצוב חדש ומסודר בתוך ה-Description במקום ב-Fields
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📊 הפרופיל של ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `**🌟 רמה:** ${userProfile.level}\n\n` +
                `**✨ ניסיון (XP):** ${userProfile.xp} מתוך ${xpNeeded}\n\n` +
                `**🪙 מטבעות:** ${userProfile.coins}\n\n` +
                `**💬 התקדמות משימה (הודעות):** ${userProfile.messagesCount} מתוך 100`
            )
            .setFooter({ text: 'המשיכו להיות פעילים כדי לעלות רמות ולזכות בפרסים!' });

        // reply עם ephemeral: true אומר שרק המשתמש יראה את ההודעה
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};