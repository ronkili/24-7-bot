require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
    console.log('❌ commands folder not found');
    process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

console.log('📂 Found command files:', commandFiles);

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
        const command = require(filePath);

        if (!command.data) {
            console.log(`❌ Missing data in command: ${file}`);
            continue;
        }

        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command for deploy: ${command.data.name}`);

    } catch (error) {
        console.log(`❌ Failed to load command: ${file}`);
        console.error(error);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Started refreshing slash commands...');

        if (!process.env.CLIENT_ID) {
            console.log('❌ Missing CLIENT_ID in .env');
            process.exit(1);
        }

        if (!process.env.GUILD_ID) {
            console.log('❌ Missing GUILD_ID in .env');
            process.exit(1);
        }

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log('✅ Successfully deployed slash commands!');
        console.log(`✅ Deployed ${commands.length} commands`);

    } catch (error) {
        console.error('❌ Deploy error:', error);
    }
})();
