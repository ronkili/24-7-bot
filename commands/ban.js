const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('נותן באן (הרחקה לצמיתות) למשתמש')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('המשתמש שתרצה לתת לו באן')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('סיבת הבאן')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
        
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'לא צוינה סיבה';
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ content: '❌ המשתמש לא נמצא בשרת.', ephemeral: true });
        }

        // בדיקה שהבוט יכול לתת באן למשתמש (בודק היררכיית תפקידים)
        if (!targetMember.bannable) {
            return interaction.reply({ content: '❌ אין לי הרשאות לתת באן למשתמש הזה (הוא כנראה מעליי בהיררכיה).', ephemeral: true });
        }

        try {
            // ניסיון לשלוח הודעה פרטית למשתמש לפני הבאן
            await targetUser.send(`🔨 קיבלת באן משרת **${interaction.guild.name}**.\n**סיבה:** ${reason}`).catch(() => {});
            
            await targetMember.ban({ reason: reason });

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔨 משתמש קיבל באן!')
                .setDescription(`**${targetUser.tag}** הורחק מהשרת.\n**סיבה:** ${reason}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ אירעה שגיאה בעת מתן הבאן.', ephemeral: true });
        }
    }
};
