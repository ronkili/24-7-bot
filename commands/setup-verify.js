const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('יוצר פאנל Verify')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('✅ Verify')
            .setDescription('לחץ על הכפתור למטה כדי לאמת את עצמך ולקבל גישה לשרת.');

        const button = new ButtonBuilder()
            .setCustomId('start_verify')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        await interaction.reply({
            content: '✅ פאנל Verify נוצר!',
            ephemeral: true
        });
    }
};
