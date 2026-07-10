require("dotenv").config();

const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// =====================
// CONFIG
// =====================

const DATA_FILE = "./casinoData.json";

const START_MONEY = 1000;
const DAILY_MONEY = 750;
const WEEKLY_MONEY = 3500;
const MONTHLY_MONEY = 12000;
const MAX_BET = 250000;

const LEADERBOARD_CHANNEL_ID = "1524838815951229118";

const activeCrash = new Map();
const activeMines = new Map();
const activeBlackjack = new Map();
const activeTicTacToe = new Map();

// =====================
// DATA
// =====================

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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

// =====================
// HELPERS
// =====================

function money(n) {
  return Number(n || 0).toLocaleString("he-IL");
}

function embed(title, desc, color = "Gold") {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setTimestamp();
}

function isCasinoManager(member) {
  return member.roles.cache.has(process.env.CASINO_MANAGER_ROLE_ID);
}

function validateBet(userData, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    return "❌ סכום לא תקין.";
  }

  if (amount < 10) {
    return "❌ מינימום הימור הוא **10 שקלים**.";
  }

  if (amount > MAX_BET) {
    return `❌ מקסימום הימור הוא **${money(MAX_BET)} שקלים**.`;
  }

  if (userData.money < amount) {
    return `❌ אין לך מספיק שקלים.\nיתרה: **${money(userData.money)} שקלים**.`;
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

function cooldownText(left) {
  const days = Math.floor(left / 1000 / 60 / 60 / 24);
  const hours = Math.floor((left / 1000 / 60 / 60) % 24);
  const minutes = Math.floor((left / 1000 / 60) % 60);

  if (days > 0) {
    return `${days} ימים, ${hours} שעות ו־${minutes} דקות`;
  }

  return `${hours} שעות ו־${minutes} דקות`;
}

function getLeaderboardEmbed() {
  const data = loadData();

  const top = Object.entries(data)
    .filter(([id, user]) => user && typeof user.money === "number")
    .sort((a, b) => b[1].money - a[1].money)
    .slice(0, 10);

  if (!top.length) {
    return embed("🏆 טבלת העשירים", "אין עדיין נתונים.", "Gold");
  }

  const text = top
    .map(([id, user], i) => {
      return `**${i + 1}.** <@${id}> — **${money(user.money)} שקלים**`;
    })
    .join("\n");

  return embed("🏆 טבלת העשירים", text, "Gold");
}

async function sendHourlyLeaderboard() {
  const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
  if (!channel) return;

  channel.send({
    embeds: [getLeaderboardEmbed()]
  }).catch(() => {});
}

// =====================
// CRASH
// =====================

function crashButton(userId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`crash_cashout_${userId}`)
        .setLabel("Cash Out")
        .setEmoji("💸")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled)
    )
  ];
}

// =====================
// MINES
// =====================

function getMinesMultiplier(game) {
  return 1 + game.revealed.length * (0.25 + game.mineCount * 0.08);
}

function minesRows(game, revealAll = false) {
  const rows = [];

  for (let r = 0; r < 4; r++) {
    const row = new ActionRowBuilder();

    for (let c = 0; c < 4; c++) {
      const i = r * 4 + c;
      const revealed = game.revealed.includes(i);
      const isMine = game.mines.includes(i);

      let label = " ";
      let style = ButtonStyle.Secondary;
      let disabled = false;

      if (revealed) {
        label = "✅";
        style = ButtonStyle.Success;
        disabled = true;
      }

      if (revealAll && isMine) {
        label = "💣";
        style = ButtonStyle.Danger;
        disabled = true;
      }

      if (revealAll && !isMine && !revealed) {
        label = "▫️";
        style = ButtonStyle.Secondary;
        disabled = true;
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mine_${game.id}_${i}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }

    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`minecash_${game.id}`)
        .setLabel(`Cash Out x${getMinesMultiplier(game).toFixed(2)}`)
        .setEmoji("💸")
        .setStyle(ButtonStyle.Success)
        .setDisabled(revealAll)
    )
  );

  return rows;
}

// =====================
// BLACKJACK
// =====================

function createDeck() {
  const suits = ["♠️", "♥️", "♦️", "♣️"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }

  return deck;
}

function drawCard(deck) {
  return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
}

function cardValue(card) {
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return Number(card.rank);
}

function handValue(hand) {
  let value = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter(card => card.rank === "A").length;

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

function handText(hand) {
  return hand.map(card => `${card.rank}${card.suit}`).join(" ");
}

function blackjackButtons(userId, canDouble = true, disabled = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit_${userId}`)
      .setLabel("Hit")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId(`bj_stand_${userId}`)
      .setLabel("Stand")
      .setEmoji("✋")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId(`bj_double_${userId}`)
      .setLabel("Double")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || !canDouble)
  );

  return [row];
}

function blackjackResultEmbed(game, userData, title, resultText, color) {
  return embed(
    title,
    `🧑 הקלפים שלך: **${handText(game.player)}** (**${handValue(game.player)}**)
🤵 הדילר: **${handText(game.dealer)}** (**${handValue(game.dealer)}**)

${resultText}

💵 יתרה: **${money(userData.money)} שקלים**.`,
    color
  );
}

// =====================
// ROULETTE
// =====================

function rouletteColor(number) {
  if (number === 0) return "green";

  const redNumbers = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36
  ]);

  return redNumbers.has(number) ? "red" : "black";
}

function rouletteBetName(bet) {
  const names = {
    red: "אדום",
    black: "שחור",
    green: "ירוק",
    even: "זוגי",
    odd: "אי זוגי",
    low: "נמוך 1-18",
    high: "גבוה 19-36"
  };

  return names[bet] || bet;
}

function rouletteColorName(color) {
  const names = {
    red: "אדום 🔴",
    black: "שחור ⚫",
    green: "ירוק 🟢"
  };

  return names[color] || color;
}// =====================
// TIC TAC TOE
// =====================

function checkTicTacToeWinner(board) {
  const wins = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const [a, b, c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every(Boolean)) return "draw";
  return null;
}

function ticTacToeRows(game, disabled = false) {
  const rows = [];

  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();

    for (let c = 0; c < 3; c++) {
      const index = r * 3 + c;
      const value = game.board[index];

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_move_${game.id}_${index}`)
          .setLabel(value || "‎ ")
          .setStyle(
            value === "X"
              ? ButtonStyle.Danger
              : value === "O"
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
          )
          .setDisabled(disabled || Boolean(value))
      );
    }

    rows.push(row);
  }

  return rows;
}

function tttAcceptRows(gameId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ttt_accept_${gameId}`)
        .setLabel("אשר משחק")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId(`ttt_decline_${gameId}`)
        .setLabel("סרב")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

function getBotMove(game) {
  const empty = game.board
    .map((value, index) => value ? null : index)
    .filter(index => index !== null);

  if (empty.length === 0) return null;

  if (game.difficulty === "easy") {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  const botSymbol = "O";
  const playerSymbol = "X";

  function findWinningMove(symbol) {
    for (const index of empty) {
      const copy = [...game.board];
      copy[index] = symbol;

      if (checkTicTacToeWinner(copy) === symbol) {
        return index;
      }
    }

    return null;
  }

  const winMove = findWinningMove(botSymbol);
  if (winMove !== null) return winMove;

  if (game.difficulty === "medium") {
    const shouldBlock = Math.random() < 0.65;

    if (shouldBlock) {
      const blockMove = findWinningMove(playerSymbol);
      if (blockMove !== null) return blockMove;
    }

    return empty[Math.floor(Math.random() * empty.length)];
  }

  const blockMove = findWinningMove(playerSymbol);
  if (blockMove !== null) return blockMove;

  if (empty.includes(4)) return 4;

  const corners = [0, 2, 6, 8].filter(i => empty.includes(i));
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  return empty[Math.floor(Math.random() * empty.length)];
}

function ticTacToeText(game) {
  let modeText = "";

  if (game.mode === "bot") {
    modeText = `🤖 מצב: נגד הבוט\nרמה: **${game.difficultyName}**`;
  } else {
    modeText = `👤 מצב: נגד בן אדם`;
  }

  return `❌ X: <@${game.playerX}>
⭕ O: ${game.playerO === "BOT" ? "**הבוט**" : `<@${game.playerO}>`}
💰 הימור: **${money(game.amount)} שקלים**
${modeText}

התור של: ${game.turn === "BOT" ? "**הבוט**" : `<@${game.turn}>`}`;
}

function finishTicTacToe(game, winnerSymbol) {
  const data = loadData();

  const userX = getUser(data, game.playerX);
  const userO = game.playerO !== "BOT" ? getUser(data, game.playerO) : null;

  activeTicTacToe.delete(game.id);

  if (winnerSymbol === "draw") {
    userX.money += game.amount;

    if (userO) {
      userO.money += game.amount;
    }

    saveData(data);

    return {
      embed: embed(
        "⭕ איקס עיגול - תיקו",
        `המשחק נגמר בתיקו.
הכסף הוחזר לשחקנים.`,
        "Gold"
      ),
      components: ticTacToeRows(game, true)
    };
  }

  const winnerId = winnerSymbol === "X" ? game.playerX : game.playerO;
  const loserId = winnerSymbol === "X" ? game.playerO : game.playerX;

  if (winnerId === "BOT") {
    const loserData = getUser(data, loserId);
    addLoss(loserData, game.amount);

    saveData(data);

    return {
      embed: embed(
        "⭕ איקס עיגול",
        `🤖 הבוט ניצח!
<@${loserId}> הפסיד **${money(game.amount)} שקלים**.`,
        "Red"
      ),
      components: ticTacToeRows(game, true)
    };
  }

  const winnerData = getUser(data, winnerId);
  addWin(winnerData, game.amount * 2);

  if (loserId !== "BOT") {
    const loserData = getUser(data, loserId);
    addLoss(loserData, game.amount);
  }

  saveData(data);

  return {
    embed: embed(
      "⭕ איקס עיגול",
      `🏆 המנצח הוא <@${winnerId}>!
הוא זכה ב־**${money(game.amount * 2)} שקלים**.`,
      "Green"
    ),
    components: ticTacToeRows(game, true)
  };
}

// =====================
// READY
// =====================

client.once(Events.ClientReady, () => {
  console.log(`✅ Casino Bot מחובר בתור ${client.user.tag}`);

  sendHourlyLeaderboard();

  setInterval(() => {
    sendHourlyLeaderboard();
  }, 60 * 60 * 1000);
});

// =====================
// INTERACTIONS
// =====================

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    const data = loadData();

    // =====================
    // BUTTONS
    // =====================

    if (interaction.isButton()) {

      // =====================
      // CRASH BUTTON
      // =====================

      if (interaction.customId.startsWith("crash_cashout_")) {
        const userId = interaction.customId.replace("crash_cashout_", "");

        if (interaction.user.id !== userId) {
          return interaction.reply({
            content: "❌ זה לא המשחק שלך.",
            ephemeral: true
          });
        }

        const game = activeCrash.get(userId);

        if (!game) {
          return interaction.reply({
            content: "❌ אין לך משחק Crash פעיל.",
            ephemeral: true
          });
        }

        clearInterval(game.interval);
        activeCrash.delete(userId);

        const userData = getUser(data, userId);
        const payout = Math.floor(game.bet * game.multiplier);

        addWin(userData, payout);
        saveData(data);

        return interaction.update({
          embeds: [
            embed(
              "🎯 Crash",
              `💸 עשית Cash Out ב־**x${game.multiplier.toFixed(2)}**!
זכית ב־**${money(payout)} שקלים**.
יתרה: **${money(userData.money)} שקלים**.`,
              "Green"
            )
          ],
          components: crashButton(userId, true)
        });
      }

      // =====================
      // MINES BUTTONS
      // =====================

      if (interaction.customId.startsWith("mine_")) {
        const [, gameId, indexRaw] = interaction.customId.split("_");
        const index = Number(indexRaw);
        const game = activeMines.get(gameId);

        if (!game) {
          return interaction.reply({
            content: "❌ המשחק נגמר.",
            ephemeral: true
          });
        }

        if (interaction.user.id !== game.userId) {
          return interaction.reply({
            content: "❌ זה לא המשחק שלך.",
            ephemeral: true
          });
        }

        if (game.revealed.includes(index)) {
          return interaction.reply({
            content: "❌ כבר פתחת את המשבצת הזאת.",
            ephemeral: true
          });
        }

        const userData = getUser(data, game.userId);

        if (game.mines.includes(index)) {
          activeMines.delete(gameId);
          addLoss(userData, game.bet);
          saveData(data);

          return interaction.update({
            embeds: [
              embed(
                "💣 Mines",
                `💥 נפלת על מוקש!
הפסדת **${money(game.bet)} שקלים**.
יתרה: **${money(userData.money)} שקלים**.`,
                "Red"
              )
            ],
            components: minesRows(game, true)
          });
        }

        game.revealed.push(index);
        activeMines.set(gameId, game);

        return interaction.update({
          embeds: [
            embed(
              "💣 Mines",
              `✅ מצאת משבצת בטוחה!
מוקשים: **${game.mineCount}**
מכפיל נוכחי: **x${getMinesMultiplier(game).toFixed(2)}**
Cash Out נוכחי: **${money(Math.floor(game.bet * getMinesMultiplier(game)))} שקלים**.`
            )
          ],
          components: minesRows(game)
        });
      }

      if (interaction.customId.startsWith("minecash_")) {
        const gameId = interaction.customId.replace("minecash_", "");
        const game = activeMines.get(gameId);

        if (!game) {
          return interaction.reply({
            content: "❌ המשחק נגמר.",
            ephemeral: true
          });
        }

        if (interaction.user.id !== game.userId) {
          return interaction.reply({
            content: "❌ זה לא המשחק שלך.",
            ephemeral: true
          });
        }

        const userData = getUser(data, game.userId);
        const payout = Math.floor(game.bet * getMinesMultiplier(game));

        activeMines.delete(gameId);
        addWin(userData, payout);
        saveData(data);

        return interaction.update({
          embeds: [
            embed(
              "💣 Mines",
              `💸 עשית Cash Out!
זכית ב־**${money(payout)} שקלים**.
יתרה: **${money(userData.money)} שקלים**.`,
              "Green"
            )
          ],
          components: minesRows(game, true)
        });
      }