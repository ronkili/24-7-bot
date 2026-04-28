const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('voicemute')
        .setDescription('Mute a member in voice')

        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('המשתמש למיוט')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('time')
                .setDescription('זמן למיוט (10s / 10m / 1h)')
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('סיבה למיוט')
                .setRequired(false)
        ),

    async execute(interaction) {

        try {

            const staffRoleId = "1496162203147964426";
            const warnLogsChannelId = "1498316795260567612";

            if (!interaction.member.roles.cache.has(staffRoleId)) {

                return interaction.reply({
                    content: "❌ אין לך הרשאה",
                    ephemeral: true
                });

            }

            const member =
                interaction.options.getMember('user');

            const timeArg =
                interaction.options.getString('time');

            const reason =
                interaction.options.getString('reason')
                || "אין סיבה";

            if (!member.voice.channel) {

                return interaction.reply({
                    content: "❌ המשתמש לא ב-Voice",
                    ephemeral: true
                });

            }

            function parseTime(time) {

                const num = parseInt(time);

                if (time.endsWith("s")) return num * 1000;
                if (time.endsWith("m")) return num * 60 * 1000;
                if (time.endsWith("h")) return num * 60 * 60 * 1000;

                return null;

            }

            const duration = parseTime(timeArg);

            if (!duration) {

                return interaction.reply({
                    content: "❌ זמן לא תקין (10s / 10m / 1h)",
                    ephemeral: true
                });

            }

            await member.voice.setMute(true, reason);

            const now = new Date();

            const muteEmbed = new EmbedBuilder()

                .setColor("Red")

                .setTitle("⚠️ Member Voice Muted")

                .addFields(

                    {
                        name: "Moderator",
                        value:
`<@${interaction.user.id}> (${interaction.user.username})`
                    },

                    {
                        name: "Member",
                        value:
`<@${member.id}> (${member.user.username})`
                    },

                    {
                        name: "Reason",
                        value: reason
                    },

                    {
                        name: "Mute Time",
                        value:
`${now.toLocaleString()}`
                    },

                    {
                        name: "Duration",
                        value: timeArg
                    }

                )

                .setFooter({
                    text:
`Moderation System • ${now.toLocaleString()}`
                });

            const logsChannel =
                interaction.guild.channels.cache.get(warnLogsChannelId);

            if (logsChannel) {

                logsChannel.send({
                    embeds: [muteEmbed]
                });

            }

            await interaction.reply({
                embeds: [muteEmbed]
            });
// ניסיון לשלוח DM למשתמש
try {

    const dmEmbed = new EmbedBuilder()

        .setColor("Red")

        .setTitle("🔇 קיבלת Voice Mute")

        .addFields(

            {
                name: "Moderator",
                value:
`<@${interaction.user.id}> (${interaction.user.username})`
            },

            {
                name: "Reason",
                value: reason
            },

            {
                name: "Duration",
                value: timeArg
            }

        )

        .setFooter({
            text: "Night Vibes Moderation System"
        });

    await member.send({
        embeds: [dmEmbed]
    });

} catch {

    console.log("❌ לא ניתן לשלוח DM למשתמש");

}

            // הורדת mute אחרי הזמן
            setTimeout(async () => {

                try {

                    await member.voice.setMute(false);

                } catch {}

            }, duration);

        } catch (error) {

            console.log(error);

            if (!interaction.replied) {

                interaction.reply({
                    content: "❌ הייתה שגיאה בפקודה",
                    ephemeral: true
                });

            }

        }

    }

};