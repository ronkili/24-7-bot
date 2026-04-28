const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder 
} = require('discord.js');

module.exports = {

data: new SlashCommandBuilder()
.setName('warn')
.setDescription('לתת אזהרה למשתמש')
.addUserOption(option =>
    option.setName('user')
    .setDescription('המשתמש לקבל אזהרה')
    .setRequired(true))
.addStringOption(option =>
    option.setName('reason')
    .setDescription('סיבת האזהרה')
    .setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

async execute(interaction) {

const user = interaction.options.getUser('user');
const reason = interaction.options.getString('reason');

const member = interaction.guild.members.cache.get(user.id);

// Embed שנשלח למשתמש בפרטי
const dmEmbed = new EmbedBuilder()
.setTitle('⚠️ קיבלת אזהרה')
.setColor('#ff0000')
.addFields(
{ name: '📌 שרת', value: interaction.guild.name },
{ name: '📝 סיבה', value: reason },
{ name: '👮 מודרטור', value: interaction.user.tag }
)
.setTimestamp();

// Embed שנשלח לשרת
const serverEmbed = new EmbedBuilder()
.setTitle('⚠️ משתמש קיבל אזהרה')
.setColor('#ff0000')
.addFields(
{ name: '👤 משתמש', value: `<@${user.id}>` },
{ name: '👮 מודרטור', value: `<@${interaction.user.id}>` },
{ name: '📝 סיבה', value: reason }
)
.setTimestamp();

// ניסיון לשלוח בפרטי
try {

await user.send({ embeds: [dmEmbed] });

} catch (err) {

console.log('❌ לא ניתן לשלוח הודעה בפרטי למשתמש');

}

// שליחה בצ'אט
await interaction.reply({
embeds: [serverEmbed]
});

}

};