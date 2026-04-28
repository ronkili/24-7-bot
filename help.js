const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('מציג הודעת עזרה')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('המשתמש')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('הסיבה')
                .setRequired(true)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setDescription(`
❌ ${user} נדחה!

@צוות השרת, ${user} תחזיר את התג  
**סיבה:** ${reason}

*Claimed by ${interaction.user}*
            `);

        await interaction.reply({ embeds: [embed] });
    }
};