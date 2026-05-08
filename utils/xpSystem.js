const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'xpData.json');

// =======================
// XP SHOP ITEMS
// =======================
// כאן אתה בוחר את הרולים לחנות.
// id = מה שהבוט משתמש בו מאחורי הקלעים
// name = מה שיופיע בכפתור ובחנות
// price = כמה XP/Coins זה עולה
// roleId = ה-ID של הרול בדיסקורד

const shopItems = [
    {
        id: 'rich',
        name: 'rich',
        price: 1500,
        roleId: '1496162222978629736'
    },
    {
        id: 'diamond',
        name: 'diamond',
        price: 2500,
        roleId: '1496162226027888783'
    },
    {
        id: 'special',
        name: 'Special',
        price: 4500,
        roleId: '1496162228095942801'
    }
];

// =======================
// DATABASE
// =======================

function loadData() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}, null, 4));
    }

    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

// =======================
// USER DATA
// =======================

function getUserData(userId) {
    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            xp: 0,
            level: 1,
            totalXp: 0,
            coins: 0
        };

        saveData(data);
    }

    return data[userId];
}

// =======================
// ADD XP
// =======================

function addXp(userId, amount) {
    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            xp: 0,
            level: 1,
            totalXp: 0,
            coins: 0
        };
    }

    data[userId].xp += amount;
    data[userId].totalXp += amount;
    data[userId].coins += amount;

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

// =======================
// REMOVE COINS / XP SHOP BALANCE
// =======================

function removeCoins(userId, amount) {
    const data = loadData();

    if (!data[userId]) {
        data[userId] = {
            xp: 0,
            level: 1,
            totalXp: 0,
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

// =======================
// LEADERBOARD
// =======================

function getLeaderboard() {
    const data = loadData();

    return Object.entries(data)
        .sort((a, b) => {
            return b[1].level - a[1].level || b[1].xp - a[1].xp;
        })
        .slice(0, 10);
}

// =======================
// EXPORTS
// =======================

module.exports = {
    shopItems,
    getUserData,
    addXp,
    removeCoins,
    getLeaderboard
};
