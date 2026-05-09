const { SlashCommandBuilder } = require('discord.js');
const { addXp, getUserData } = require('../utils/xpSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש שיקבל XP')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('כמות XP להוסיף')
                .setRequired(true)
        ),

    async execute(interaction) {

        const staffRoleId = "1502608350364565695";

        if (!interaction.member.roles.cache.has(staffRoleId)) {
            return interaction.reply({
                content: '❌ רק Staff יכולים להוסיף XP.',
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0) {
            return interaction.reply({
                content: '❌ הכמות חייבת להיות מעל 0.',
                ephemeral: true
            });
        }

        const result = addXp(user.id, amount);
        const userData = getUserData(user.id);

        const displayXp = userData.totalXp || userData.xp || 0;

        await interaction.reply({
            content:
`✅ נוסף **${amount} XP** ל־<@${user.id}>

⭐ Level: **${userData.level}**
✨ XP: **${displayXp}**`
        });

        if (result.leveledUp) {
            try {
                await user.send(
`🎉 **עלית Level!**

⭐ הרמה החדשה שלך: **${result.user.level}
✨ XP נוכחי: **${result.user.totalXp || result.user.xp || 0}**`
                );
            } catch {}
        }
    }
};
