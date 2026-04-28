const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {

data: new SlashCommandBuilder()
.setName('setup-tickets')
.setDescription('מגדיר את מערכת הטיקטים')
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

async execute(interaction) {

const embed = new EmbedBuilder()
.setTitle('🎫 מערכת טיקטים')
.setDescription('לחץ על הכפתור למטה כדי לפתוח טיקט.')
.setColor('#2b2d31')
.setFooter({ text: 'צוות השרת כאן בשבילכם!' });

const button = new ButtonBuilder()
.setCustomId('open_ticket')
.setLabel('פתח טיקט')
.setEmoji('📩')
.setStyle(ButtonStyle.Primary);

const row = new ActionRowBuilder()
.addComponents(button);

await interaction.channel.send({
embeds: [embed],
components: [row]
});

await interaction.reply({
content: '✅ פאנל הטיקטים נוצר!',
ephemeral: true
});

}

};