const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'xpData.json');

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
            totalXp: 0
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
            totalXp: 0
        };
    }

    data[userId].xp += amount;
    data[userId].totalXp += amount;

    let leveledUp = false;

    while (data[userId].xp >= data[userId].level * 100) {
        data[userId].xp -= data[userId].level * 100;
        data[userId].level += 1;
        leveledUp = true;
    }

    saveData(data);

    return {
        user: data[userId],
        leveledUp
    };
}

function getLeaderboard() {
    const data = loadData();

    return Object.entries(data)
        .sort((a, b) => {
            return b[1].level - a[1].level || b[1].xp - a[1].xp;
        })
        .slice(0, 10);
}

module.exports = {
    getUserData,
    addXp,
    getLeaderboard
};
