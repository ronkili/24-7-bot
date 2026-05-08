const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { shopItems } = require('../utils/xpSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Shows the XP shop'),

    async execute(interaction) {
        let description = '';

        for (const item of shopItems) {
            description += `🛒 **${item.name}**\nID: \`${item.id}\`\nמחיר: **${item.price} Coins**\n\n`;
        }

        if (!description) {
            description = 'אין פריטים בחנות.';
        }

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🛍️ XP Shop')
            .setDescription(description);

        await interaction.reply({
            embeds: [embed]
        });
    }
};
