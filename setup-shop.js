const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-shop')
        .setDescription('מגדיר ושולח את חנות התפקידים לערוץ הנוכחי')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        // משיכת האיידיז מקובץ ה-.env כדי להציג אותם יפה
        const roleSpecial = process.env.ROLE_SPECIAL_ID;
        const roleLegendary = process.env.ROLE_LEGENDARY_ID;
        const roleCrazy = process.env.ROLE_CRAZY_ID;
        const roleElite = process.env.ROLE_ELITE_ID;
        const roleLegend = process.env.ROLE_LEGEND_ID;

        const embed = new EmbedBuilder()
            .setTitle(`${interaction.guild.name} | Community Coins Shop 🛒`)
            .setDescription('קנו תפקידים מיוחדים מהחנות שלנו!\nבחרו את התפקיד שתרצו ולחצו על הכפתור המתאים כדי לרכוש אותו באמצעות **המטבעות (Coins)** שלכם.\n\n**תפקידים זמינים:**\n' +
                `**1.** <@&${roleSpecial}> - 10,000 🪙\n` +
                `**2.** <@&${roleLegendary}> - 15,000 🪙\n` +
                `**3.** <@&${roleCrazy}> - 25,000 🪙\n` +
                `**4.** <@&${roleElite}> - 40,000 🪙\n` +
                `**5.** <@&${roleLegend}> - 50,000 🪙`)
            .setColor('#2b2d31')
            .setImage('https://i.imgur.com/YOUR_SHOP_BANNER.png'); // אפשר להוסיף פה לינק לתמונה יפה של חנות כמו בצילום מסך

        // יצירת הכפתורים לחנות
        const button1 = new ButtonBuilder().setCustomId('shop_special').setLabel('Special').setEmoji('🎁').setStyle(ButtonStyle.Primary);
        const button2 = new ButtonBuilder().setCustomId('shop_legendary').setLabel('Legendary').setEmoji('👑').setStyle(ButtonStyle.Primary);
        const button3 = new ButtonBuilder().setCustomId('shop_crazy').setLabel('Crazy').setEmoji('🔥').setStyle(ButtonStyle.Primary);
        const button4 = new ButtonBuilder().setCustomId('shop_elite').setLabel('Elite').setEmoji('💎').setStyle(ButtonStyle.Primary);
        const button5 = new ButtonBuilder().setCustomId('shop_legend').setLabel('Legend').setEmoji('⭐').setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button1, button2, button3, button4, button5);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ החנות הוגדרה בהצלחה!', ephemeral: true });
    }
};