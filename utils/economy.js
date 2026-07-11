const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "casinoData.json");

const START_MONEY = 1000;
const MAX_BET = 250000;

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "{}", "utf8");
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function getUser(data, id) {
  if (!data[id]) {
    data[id] = {
      money: START_MONEY,
      gamesPlayed: 0,
      totalBet: 0,
      totalWon: 0,
      totalLost: 0,
      biggestWin: 0,
      lastDaily: 0,
      lastWeekly: 0,
      lastMonthly: 0
    };
  }

  return data[id];
}

function money(amount) {
  return Number(amount || 0).toLocaleString("he-IL");
}

function validateBet(userData, amount) {
  if (!Number.isInteger(amount) || amount < 10) {
    return "❌ מינימום הימור הוא 10 שקלים.";
  }

  if (amount > MAX_BET) {
    return `❌ מקסימום הימור הוא ${money(MAX_BET)} שקלים.`;
  }

  if (userData.money < amount) {
    return `❌ אין לך מספיק שקלים. יתרה: ${money(userData.money)}.`;
  }

  return null;
}

function placeBet(userData, amount) {
  userData.money -= amount;
  userData.totalBet += amount;
  userData.gamesPlayed += 1;
}

function addWin(userData, payout) {
  userData.money += payout;
  userData.totalWon += payout;

  if (payout > userData.biggestWin) {
    userData.biggestWin = payout;
  }
}

function addLoss(userData, amount) {
  userData.totalLost += amount;
}

module.exports = {
  START_MONEY,
  loadData,
  saveData,
  getUser,
  money,
  validateBet,
  placeBet,
  addWin,
  addLoss
};