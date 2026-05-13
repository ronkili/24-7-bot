const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('זורק משתמש מהשרת (Kick)')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('המשתמש שתרצה לזרוק')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('סיבת הזריקה')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
        
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'לא צוינה סיבה';
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.reply({ content: '❌ המשתמש לא נמצא בשרת.', ephemeral: true });
        if (!targetMember.kickable) return interaction.reply({ content: '❌ אין לי הרשאות לזרוק את המשתמש הזה.', ephemeral: true });

        try {
            await targetUser.send(`👢 נזרקת משרת **${interaction.guild.name}**.\n**סיבה:** ${reason}`).catch(() => {});
            await targetMember.kick(reason);

            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('👢 משתמש נזרק (Kick)')
                .setDescription(`**${targetUser.tag}** נזרק מהשרת.\n**סיבה:** ${reason}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ אירעה שגיאה.', ephemeral: true });
        }
    }
};
