const { SlashCommandBuilder } = require('discord.js');
const { shopItems, getUserData, removeCoins } = require('../utils/xpSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the XP shop')
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('ID של הפריט מהחנות')
                .setRequired(true)
        ),

    async execute(interaction) {
        const itemId = interaction.options.getString('item');
        const item = shopItems.find(i => i.id === itemId);

        if (!item) {
            return interaction.reply({
                content: '❌ הפריט לא נמצא בחנות.',
                ephemeral: true
            });
        }

        const data = getUserData(interaction.user.id);

        if (data.coins < item.price) {
            return interaction.reply({
                content: `❌ אין לך מספיק Coins. צריך **${item.price}**, ויש לך **${data.coins}**.`,
                ephemeral: true
            });
        }

        const role = interaction.guild.roles.cache.get(item.roleId);

        if (!role) {
            return interaction.reply({
                content: '❌ הרול של הפריט לא נמצא. בדוק את ה-roleId בקוד.',
                ephemeral: true
            });
        }

        if (interaction.member.roles.cache.has(item.roleId)) {
            return interaction.reply({
                content: '❌ כבר יש לך את הפריט הזה.',
                ephemeral: true
            });
        }

        const paid = removeCoins(interaction.user.id, item.price);

        if (!paid) {
            return interaction.reply({
                content: '❌ אין לך מספיק Coins.',
                ephemeral: true
            });
        }

        await interaction.member.roles.add(role);

        await interaction.reply({
            content: `✅ קנית את **${item.name}** במחיר **${item.price} Coins**!`
        });
    }
};
