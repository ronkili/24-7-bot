const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'xpData.json');

const shopItems = [
    {
        id: 'vip',
        name: 'VIP Role',
        price: 500,
        roleId: 'PUT_VIP_ROLE_ID'
    },
    {
        id: 'color',
        name: 'Special Color Role',
        price: 300,
        roleId: 'PUT_COLOR_ROLE_ID'
    },
    {
        id: 'legend',
        name: 'Legend Role',
        price: 1000,
        roleId: 'PUT_LEGEND_ROLE_ID'
    }
];

function loadData() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
    }

    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

function getUserData(userId) {
    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            xp: 0,
            level: 1,
            coins: 0
        };

        saveData(data);
    }

    return data[userId];
}

function addXp(userId, amount) {
    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            xp: 0,
            level: 1,
            coins: 0
        };
    }

    data[userId].xp += amount;
    data[userId].coins += amount;

    const neededXp = data[userId].level * 100;
    let leveledUp = false;

    while (data[userId].xp >= neededXp) {
        data[userId].xp -= neededXp;
        data[userId].level += 1;
        leveledUp = true;
        break;
    }

    saveData(data);

    return {
        user: data[userId],
        leveledUp
    };
}

function removeCoins(userId, amount) {
    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            xp: 0,
            level: 1,
            coins: 0
        };
    }

    if (data[userId].coins < amount) {
        return false;
    }

    data[userId].coins -= amount;
    saveData(data);

    return true;
}

function getLeaderboard() {
    const data = loadData();

    return Object.entries(data)
        .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
        .slice(0, 10);
}

module.exports = {
    shopItems,
    getUserData,
    addXp,
    removeCoins,
    getLeaderboard
};
