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
        .setName('setup-tickets')
        .setDescription('יוצר פאנל טיקטים')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🎫 מערכת טיקטים')
            .setDescription('בחר את סוג הטיקט שאתה רוצה לפתוח מהרשימה למטה.');

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_staff_test')
                    .setLabel('בחינה לצוות')
                    .setEmoji('❤')
                    .setStyle(ButtonStyle.Primary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_complaint')
                    .setLabel('להתלונן')
                    .setEmoji('❗')
                    .setStyle(ButtonStyle.Danger)
            );

        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_partner')
                    .setLabel('שתפ')
                    .setEmoji('🤝')
                    .setStyle(ButtonStyle.Success)
            );

        const row4 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_help')
                    .setLabel('עזרה')
                    .setEmoji('🙏')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row5 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_other')
                    .setLabel('אחר')
                    .setEmoji('❓')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.channel.send({
            embeds: [embed],
            components: [row1, row2, row3, row4, row5]
        });

        await interaction.reply({
            content: '✅ פאנל הטיקטים נוצר!',
            ephemeral: true
        });
    }
};
