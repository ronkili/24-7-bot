const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const ticketStaffRoleId = "1503006133684670525";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש להוסיף לטיקט')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ticketStaffRoleId)) {
            return interaction.reply({
                content: '❌ רק Staff Tester יכולים להשתמש בזה.',
                ephemeral: true
            });
        }

        if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ הפקודה הזאת עובדת רק בתוך טיקט.',
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');

        await interaction.channel.permissionOverwrites.edit(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        await interaction.reply({
            content: `✅ <@${user.id}> נוסף לטיקט.`
        });
    }
};
