const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const { shopItems } = require('../utils/xpSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('פותח את חנות ה-XP'),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🛒 XP Shop')
            .setDescription(
                shopItems.map(item =>
                    `**${item.name}** — **${item.price} XP**`
                ).join('\n')
            );

        const row = new ActionRowBuilder();

        for (const item of shopItems.slice(0, 5)) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`xp_shop_buy_${item.id}`)
                    .setLabel(item.name)
                    .setStyle(ButtonStyle.Primary)
            );
        }

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};
