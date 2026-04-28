const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('מוחק כמות מסוימת של הודעות מהערוץ (לצוות בלבד)')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('כמות ההודעות למחיקה (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        // מגביל את הפקודה רק למי שיש הרשאת ניהול הודעות
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        // מוחק את ההודעות
        const deletedMessages = await interaction.channel.bulkDelete(amount, true);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setDescription(`🧹 נמחקו בהצלחה **${deletedMessages.size}** הודעות!`);

        // עונה למי שהריץ את הפקודה בהודעה שרק הוא רואה
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};