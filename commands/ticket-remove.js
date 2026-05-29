const { SlashCommandBuilder } = require('discord.js');

const ticketStaffRoleId = "1503006133684670525";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש להסיר מהטיקט')
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

        await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});

        await interaction.reply({
            content: `✅ <@${user.id}> הוסר מהטיקט.`
        });
    }
};
