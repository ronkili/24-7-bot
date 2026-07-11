const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  START_MONEY,
  loadData,
  saveData,
  getUser,
  money,
  validateBet,
  placeBet,
  addWin,
  addLoss
} = require("../utils/economy");

const DAILY_MONEY = 750;
const WEEKLY_MONEY = 3500;
const MONTHLY_MONEY = 12000;

const activeCrash = new Map();
const activeMines = new Map();
const activeBlackjack = new Map();
const activeTicTacToe = new Map();

function makeEmbed(title, description, color = "Gold") {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

function casinoManager(member) {
  return Boolean(
    process.env.CASINO_MANAGER_ROLE_ID &&
    member.roles.cache.has(process.env.CASINO_MANAGER_ROLE_ID)
  );
}

function disabledRows(rows) {
  for (const row of rows) {
    for (const button of row.components) {
      button.setDisabled(true);
    }
  }

  return rows;
}

// =====================
// BALANCE
// =====================

const balance = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("בדיקת יתרת שקלים")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("משתמש לבדיקה")
        .setRequired(false)
    ),

  async execute(interaction) {
    const data = loadData();
    const target = interaction.options.getUser("user") || interaction.user;
    const userData = getUser(data, target.id);

    saveData(data);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "💳 מערכת שקלים",
          `👤 משתמש: ${target}\n💵 יתרה: **${money(userData.money)} שקלים**`
        )
      ]
    });
  }
};

// =====================
// REWARDS
// =====================

function rewardCommand(name, description, reward, cooldown, key) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description),

    async execute(interaction) {
      const data = loadData();
      const userData = getUser(data, interaction.user.id);
      const now = Date.now();

      if (now - userData[key] < cooldown) {
        const left = cooldown - (now - userData[key]);
        const hours = Math.floor(left / 3600000);
        const minutes = Math.floor((left % 3600000) / 60000);

        return interaction.reply({
          content: `⏳ תוכל לקחת שוב בעוד ${hours} שעות ו־${minutes} דקות.`,
          ephemeral: true
        });
      }

      userData.money += reward;
      userData[key] = now;
      saveData(data);

      return interaction.reply({
        embeds: [
          makeEmbed(
            `💸 ${description}`,
            `קיבלת **${money(reward)} שקלים**.\nיתרה: **${money(userData.money)} שקלים**.`,
            "Green"
          )
        ]
      });
    }
  };
}

const daily = rewardCommand(
  "daily",
  "פרס יומי",
  DAILY_MONEY,
  24 * 60 * 60 * 1000,
  "lastDaily"
);

const weekly = rewardCommand(
  "weekly",
  "פרס שבועי",
  WEEKLY_MONEY,
  7 * 24 * 60 * 60 * 1000,
  "lastWeekly"
);

const monthly = rewardCommand(
  "monthly",
  "פרס חודשי",
  MONTHLY_MONEY,
  30 * 24 * 60 * 60 * 1000,
  "lastMonthly"
);

// =====================
// STATS + LEADERBOARD
// =====================

const stats = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("סטטיסטיקות קזינו")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("משתמש לבדיקה")
        .setRequired(false)
    ),

  async execute(interaction) {
    const data = loadData();
    const target = interaction.options.getUser("user") || interaction.user;
    const userData = getUser(data, target.id);

    saveData(data);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "📈 סטטיסטיקות קזינו",
          `👤 משתמש: ${target}
💵 יתרה: **${money(userData.money)} שקלים**
🎮 משחקים: **${userData.gamesPlayed}**
💰 הימורים: **${money(userData.totalBet)} שקלים**
📈 זכיות: **${money(userData.totalWon)} שקלים**
📉 הפסדים: **${money(userData.totalLost)} שקלים**
🏆 זכייה גדולה: **${money(userData.biggestWin)} שקלים**`
        )
      ]
    });
  }
};

function buildLeaderboardEmbed() {
  const data = loadData();

  const top = Object.entries(data)
    .filter(([, user]) => user && typeof user.money === "number")
    .sort((a, b) => b[1].money - a[1].money)
    .slice(0, 10);

  const text = top.length
    ? top
        .map(
          ([id, user], index) =>
            `**${index + 1}.** <@${id}> — **${money(user.money)} שקלים**`
        )
        .join("\n")
    : "אין עדיין נתונים.";

  return makeEmbed("🏆 טבלת העשירים", text);
}

const leaderboard = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("טבלת העשירים"),

  buildLeaderboardEmbed,

  async execute(interaction) {
    return interaction.reply({
      embeds: [buildLeaderboardEmbed()]
    });
  }
};

// =====================
// COINFLIP
// =====================

const coinflip = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("עץ או פלי")
    .addStringOption(option =>
      option
        .setName("choice")
        .setDescription("בחירה")
        .setRequired(true)
        .addChoices(
          { name: "עץ", value: "etz" },
          { name: "פלי", value: "pali" }
        )
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("סכום ההימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);
    const amount = interaction.options.getInteger("amount");
    const choice = interaction.options.getString("choice");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({ content: error, ephemeral: true });
    }

    placeBet(userData, amount);

    const result = Math.random() < 0.5 ? "etz" : "pali";
    const names = { etz: "עץ", pali: "פלי" };

    if (choice === result) {
      const payout = amount * 2;
      addWin(userData, payout);
      saveData(data);

      return interaction.reply({
        embeds: [
          makeEmbed(
            "🪙 עץ או פלי",
            `יצא **${names[result]}**.\n✅ זכית ב־**${money(payout)} שקלים**.\nיתרה: **${money(userData.money)} שקלים**.`,
            "Green"
          )
        ]
      });
    }

    addLoss(userData, amount);
    saveData(data);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "🪙 עץ או פלי",
          `יצא **${names[result]}**.\n❌ הפסדת **${money(amount)} שקלים**.\nיתרה: **${money(userData.money)} שקלים**.`,
          "Red"
        )
      ]
    });
  }
};

// =====================
// ROULETTE
// =====================

const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

const roulette = {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("רולטה")
    .addStringOption(option =>
      option
        .setName("bet")
        .setDescription("סוג ההימור")
        .setRequired(true)
        .addChoices(
          { name: "אדום", value: "red" },
          { name: "שחור", value: "black" },
          { name: "ירוק", value: "green" },
          { name: "זוגי", value: "even" },
          { name: "אי זוגי", value: "odd" },
          { name: "נמוך 1-18", value: "low" },
          { name: "גבוה 19-36", value: "high" }
        )
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("סכום ההימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);
    const amount = interaction.options.getInteger("amount");
    const bet = interaction.options.getString("bet");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({ content: error, ephemeral: true });
    }

    placeBet(userData, amount);

    const number = Math.floor(Math.random() * 37);
    const color =
      number === 0
        ? "green"
        : redNumbers.has(number)
          ? "red"
          : "black";

    let won = false;
    let multiplier = 2;

    if (bet === color) won = true;
    if (bet === "green" && number === 0) multiplier = 14;
    if (bet === "even" && number !== 0 && number % 2 === 0) won = true;
    if (bet === "odd" && number % 2 === 1) won = true;
    if (bet === "low" && number >= 1 && number <= 18) won = true;
    if (bet === "high" && number >= 19 && number <= 36) won = true;

    if (won) {
      const payout = amount * multiplier;
      addWin(userData, payout);
      saveData(data);

      return interaction.reply({
        embeds: [
          makeEmbed(
            "🎡 רולטה",
            `יצא מספר **${number}** (${color}).\n✅ זכית ב־**${money(payout)} שקלים**.\nיתרה: **${money(userData.money)} שקלים**.`,
            "Green"
          )
        ]
      });
    }

    addLoss(userData, amount);
    saveData(data);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "🎡 רולטה",
          `יצא מספר **${number}** (${color}).\n❌ הפסדת **${money(amount)} שקלים**.\nיתרה: **${money(userData.money)} שקלים**.`,
          "Red"
        )
      ]
    });
  }
};

// =====================
// HORSE RACE
// =====================

const horserace = {
  data: new SlashCommandBuilder()
    .setName("horserace")
    .setDescription("מרוץ סוסים")
    .addIntegerOption(option =>
      option
        .setName("horse")
        .setDescription("בחר סוס 1-5")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("סכום ההימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);
    const horse = interaction.options.getInteger("horse");
    const amount = interaction.options.getInteger("amount");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({ content: error, ephemeral: true });
    }

    placeBet(userData, amount);

    const winner = Math.floor(Math.random() * 5) + 1;

    if (horse === winner) {
      const payout = amount * 4;
      addWin(userData, payout);
      saveData(data);

      return interaction.reply({
        embeds: [
          makeEmbed(
            "🐎 מרוץ סוסים",
            `הסוס המנצח: **${winner}**\n✅ זכית ב־**${money(payout)} שקלים**.`,
            "Green"
          )
        ]
      });
    }

    addLoss(userData, amount);
    saveData(data);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "🐎 מרוץ סוסים",
          `הסוס המנצח: **${winner}**\n❌ הפסדת **${money(amount)} שקלים**.`,
          "Red"
        )
      ]
    });
  }
};

// =====================
// CRASH
// =====================

function crashRows(userId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`crash:${userId}`)
        .setLabel("Cash Out")
        .setEmoji("💸")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled)
    )
  ];
}

const crash = {
  data: new SlashCommandBuilder()
    .setName("crash")
    .setDescription("משחק Crash")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("סכום ההימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);
    const amount = interaction.options.getInteger("amount");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({ content: error, ephemeral: true });
    }

    if (activeCrash.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ כבר יש לך משחק פעיל.",
        ephemeral: true
      });
    }

    placeBet(userData, amount);
    saveData(data);

    const game = {
      amount,
      multiplier: 1,
      crashAt: 1.2 + Math.random() * 5,
      interval: null,
      message: null
    };

    activeCrash.set(interaction.user.id, game);

    await interaction.reply({
      embeds: [
        makeEmbed(
          "🎯 Crash",
          `הימור: **${money(amount)} שקלים**\nמכפיל: **x1.00**`
        )
      ],
      components: crashRows(interaction.user.id)
    });

    game.message = await interaction.fetchReply();

    game.interval = setInterval(async () => {
      const current = activeCrash.get(interaction.user.id);

      if (!current) return;

      current.multiplier += 0.15 + Math.random() * 0.25;

      if (current.multiplier >= current.crashAt) {
        clearInterval(current.interval);
        activeCrash.delete(interaction.user.id);

        const freshData = loadData();
        const freshUser = getUser(freshData, interaction.user.id);

        addLoss(freshUser, amount);
        saveData(freshData);

        return current.message.edit({
          embeds: [
            makeEmbed(
              "🎯 Crash",
              `💥 המשחק התרסק ב־**x${current.crashAt.toFixed(2)}**.\nהפסדת **${money(amount)} שקלים**.`,
              "Red"
            )
          ],
          components: crashRows(interaction.user.id, true)
        }).catch(() => {});
      }

      await current.message.edit({
        embeds: [
          makeEmbed(
            "🎯 Crash",
            `מכפיל: **x${current.multiplier.toFixed(2)}**\nCash Out: **${money(Math.floor(amount * current.multiplier))} שקלים**`
          )
        ],
        components: crashRows(interaction.user.id)
      }).catch(() => {});
    }, 1500);
  }
};

// =====================
// MINES
// =====================

function minesMultiplier(game) {
  return 1 + game.revealed.length * (0.22 + game.mineCount * 0.08);
}

function minesRows(game, end = false) {
  const rows = [];

  for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
    const row = new ActionRowBuilder();

    for (let column = 0; column < 4; column++) {
      const index = rowIndex * 4 + column;
      const revealed = game.revealed.includes(index);
      const mine = game.mines.includes(index);

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mine:${game.id}:${index}`)
          .setLabel(
            end && mine
              ? "💣"
              : revealed
                ? "✅"
                : " "
          )
          .setStyle(
            end && mine
              ? ButtonStyle.Danger
              : revealed
                ? ButtonStyle.Success
                : ButtonStyle.Secondary
          )
          .setDisabled(end || revealed)
      );
    }

    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`minecash:${game.id}`)
        .setLabel(`Cash Out x${minesMultiplier(game).toFixed(2)}`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(end)
    )
  );

  return rows;
}

const mines = {
  data: new SlashCommandBuilder()
    .setName("mines")
    .setDescription("משחק Mines")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("סכום ההימור")
        .setRequired(true)
        .setMinValue(10)
    )
    .addIntegerOption(option =>
      option
        .setName("mines")
        .setDescription("כמות מוקשים")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(8)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);
    const amount = interaction.options.getInteger("amount");
    const mineCount = interaction.options.getInteger("mines");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({ content: error, ephemeral: true });
    }

    placeBet(userData, amount);
    saveData(data);

    const minesSet = new Set();

    while (minesSet.size < mineCount) {
      minesSet.add(Math.floor(Math.random() * 16));
    }

    const game = {
      id: `${interaction.user.id}-${Date.now()}`,
      userId: interaction.user.id,
      amount,
      mineCount,
      mines: [...minesSet],
      revealed: []
    };

    activeMines.set(game.id, game);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "💣 Mines",
          `הימור: **${money(amount)} שקלים**\nמוקשים: **${mineCount}**`
        )
      ],
      components: minesRows(game)
    });
  }
};

// =====================
// BLACKJACK
// =====================

function createDeck() {
  const suits = ["♠️", "♥️", "♦️", "♣️"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  return suits.flatMap(suit =>
    ranks.map(rank => ({ rank, suit }))
  );
}

function draw(deck) {
  return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
}

function handValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === "A") {
      value += 11;
      aces++;
    } else if (["J", "Q", "K"].includes(card.rank)) {
      value += 10;
    } else {
      value += Number(card.rank);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

function handText(hand) {
  return hand.map(card => `${card.rank}${card.suit}`).join(" ");
}

function blackjackRows(userId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`blackjack:hit:${userId}`)
        .setLabel("לקחת קלף")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId(`blackjack:stand:${userId}`)
        .setLabel("לעמוד")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

const blackjack = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("בלאקג׳ק")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("סכום ההימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);
    const amount = interaction.options.getInteger("amount");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({ content: error, ephemeral: true });
    }

    placeBet(userData, amount);
    saveData(data);

    const deck = createDeck();

    const game = {
      userId: interaction.user.id,
      amount,
      deck,
      player: [draw(deck), draw(deck)],
      dealer: [draw(deck), draw(deck)]
    };

    activeBlackjack.set(interaction.user.id, game);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "🃏 Blackjack",
          `הקלפים שלך: **${handText(game.player)}** (${handValue(game.player)})\nקלף הדילר: **${handText([game.dealer[0]])}**`
        )
      ],
      components: blackjackRows(interaction.user.id)
    });
  }
};

// =====================
// TIC TAC TOE
// =====================

function winner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return board.every(Boolean) ? "draw" : null;
}

function tttRows(game, disabled = false) {
  const rows = [];

  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    const row = new ActionRowBuilder();

    for (let column = 0; column < 3; column++) {
      const index = rowIndex * 3 + column;
      const value = game.board[index];

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt:${game.id}:${index}`)
          .setLabel(value || " ")
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

function botMove(game) {
  const empty = game.board
    .map((value, index) => value ? null : index)
    .filter(index => index !== null);

  if (!empty.length) return;

  function findMove(symbol) {
    for (const index of empty) {
      const copy = [...game.board];
      copy[index] = symbol;

      if (winner(copy) === symbol) return index;
    }

    return null;
  }

  const winning = findMove("O");
  if (winning !== null) return winning;

  const block = findMove("X");
  if (block !== null) return block;

  if (!game.board[4]) return 4;

  return empty[Math.floor(Math.random() * empty.length)];
}

const tictactoe = {
  data: new SlashCommandBuilder()
    .setName("tictactoe")
    .setDescription("איקס עיגול נגד הבוט")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("סכום ההימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);
    const amount = interaction.options.getInteger("amount");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({ content: error, ephemeral: true });
    }

    placeBet(userData, amount);
    saveData(data);

    const game = {
      id: `${interaction.user.id}-${Date.now()}`,
      userId: interaction.user.id,
      amount,
      board: Array(9).fill(null)
    };

    activeTicTacToe.set(game.id, game);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "❌⭕ איקס עיגול",
          "אתה X והבוט O. לחץ על משבצת."
        )
      ],
      components: tttRows(game)
    });
  }
};

// =====================
// ADMIN MONEY
// =====================

function adminMoneyCommand(name, description, remove = false) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("משתמש")
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("סכום")
          .setRequired(true)
          .setMinValue(1)
      ),

    async execute(interaction) {
      if (!casinoManager(interaction.member)) {
        return interaction.reply({
          content: "❌ רק אחראי קזינו יכול להשתמש בזה.",
          ephemeral: true
        });
      }

      const data = loadData();
      const target = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      const targetData = getUser(data, target.id);

      if (remove) {
        targetData.money = Math.max(0, targetData.money - amount);
      } else {
        targetData.money += amount;
      }

      saveData(data);

      return interaction.reply({
        content: `✅ ${remove ? "הורדו" : "נוספו"} ${money(amount)} שקלים ל־${target}.`
      });
    }
  };
}

const addmoney = adminMoneyCommand(
  "addmoney",
  "הוספת שקלים",
  false
);

const removemoney = adminMoneyCommand(
  "removemoney",
  "הורדת שקלים",
  true
);

// =====================
// BUTTON HANDLER
// =====================

async function handleButton(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith("crash:")) {
    const userId = customId.split(":")[1];

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ זה לא המשחק שלך.",
        ephemeral: true
      });

      return true;
    }

    const game = activeCrash.get(userId);

    if (!game) {
      await interaction.reply({
        content: "❌ המשחק כבר נגמר.",
        ephemeral: true
      });

      return true;
    }

    clearInterval(game.interval);
    activeCrash.delete(userId);

    const data = loadData();
    const userData = getUser(data, userId);
    const payout = Math.floor(game.amount * game.multiplier);

    addWin(userData, payout);
    saveData(data);

    await interaction.update({
      embeds: [
        makeEmbed(
          "🎯 Crash",
          `💸 יצאת ב־x${game.multiplier.toFixed(2)}.\nזכית ב־**${money(payout)} שקלים**.`,
          "Green"
        )
      ],
      components: crashRows(userId, true)
    });

    return true;
  }

  if (customId.startsWith("mine:")) {
    const [, gameId, indexText] = customId.split(":");
    const game = activeMines.get(gameId);

    if (!game) {
      await interaction.reply({
        content: "❌ המשחק נגמר.",
        ephemeral: true
      });

      return true;
    }

    if (interaction.user.id !== game.userId) {
      await interaction.reply({
        content: "❌ זה לא המשחק שלך.",
        ephemeral: true
      });

      return true;
    }

    const index = Number(indexText);
    const data = loadData();
    const userData = getUser(data, game.userId);

    if (game.mines.includes(index)) {
      activeMines.delete(gameId);
      addLoss(userData, game.amount);
      saveData(data);

      await interaction.update({
        embeds: [
          makeEmbed(
            "💣 Mines",
            `💥 נפלת על מוקש והפסדת ${money(game.amount)} שקלים.`,
            "Red"
          )
        ],
        components: minesRows(game, true)
      });

      return true;
    }

    if (!game.revealed.includes(index)) {
      game.revealed.push(index);
    }

    await interaction.update({
      embeds: [
        makeEmbed(
          "💣 Mines",
          `משבצות בטוחות: **${game.revealed.length}**\nמכפיל: **x${minesMultiplier(game).toFixed(2)}**`
        )
      ],
      components: minesRows(game)
    });

    return true;
  }

  if (customId.startsWith("minecash:")) {
    const gameId = customId.split(":")[1];
    const game = activeMines.get(gameId);

    if (!game || interaction.user.id !== game.userId) {
      await interaction.reply({
        content: "❌ המשחק לא נמצא.",
        ephemeral: true
      });

      return true;
    }

    const data = loadData();
    const userData = getUser(data, game.userId);
    const payout = Math.floor(game.amount * minesMultiplier(game));

    activeMines.delete(gameId);
    addWin(userData, payout);
    saveData(data);

    await interaction.update({
      embeds: [
        makeEmbed(
          "💣 Mines",
          `💸 יצאת וזכית ב־**${money(payout)} שקלים**.`,
          "Green"
        )
      ],
      components: minesRows(game, true)
    });

    return true;
  }

  if (customId.startsWith("blackjack:")) {
    const [, action, userId] = customId.split(":");

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ זה לא המשחק שלך.",
        ephemeral: true
      });

      return true;
    }

    const game = activeBlackjack.get(userId);

    if (!game) {
      await interaction.reply({
        content: "❌ המשחק נגמר.",
        ephemeral: true
      });

      return true;
    }

    const data = loadData();
    const userData = getUser(data, userId);

    if (action === "hit") {
      game.player.push(draw(game.deck));

      if (handValue(game.player) > 21) {
        activeBlackjack.delete(userId);
        addLoss(userData, game.amount);
        saveData(data);

        await interaction.update({
          embeds: [
            makeEmbed(
              "🃏 Blackjack",
              `הקלפים שלך: ${handText(game.player)} (${handValue(game.player)})\n💥 עברת 21 והפסדת.`,
              "Red"
            )
          ],
          components: blackjackRows(userId, true)
        });

        return true;
      }

      await interaction.update({
        embeds: [
          makeEmbed(
            "🃏 Blackjack",
            `הקלפים שלך: **${handText(game.player)}** (${handValue(game.player)})\nקלף הדילר: **${handText([game.dealer[0]])}**`
          )
        ],
        components: blackjackRows(userId)
      });

      return true;
    }

    while (handValue(game.dealer) < 17) {
      game.dealer.push(draw(game.deck));
    }

    const playerValue = handValue(game.player);
    const dealerValue = handValue(game.dealer);

    activeBlackjack.delete(userId);

    let result;
    let color;

    if (dealerValue > 21 || playerValue > dealerValue) {
      const payout = game.amount * 2;
      addWin(userData, payout);
      result = `✅ זכית ב־${money(payout)} שקלים.`;
      color = "Green";
    } else if (playerValue === dealerValue) {
      addWin(userData, game.amount);
      result = "➖ תיקו. ההימור הוחזר.";
      color = "Gold";
    } else {
      addLoss(userData, game.amount);
      result = `❌ הפסדת ${money(game.amount)} שקלים.`;
      color = "Red";
    }

    saveData(data);

    await interaction.update({
      embeds: [
        makeEmbed(
          "🃏 Blackjack",
          `שלך: **${handText(game.player)}** (${playerValue})\nדילר: **${handText(game.dealer)}** (${dealerValue})\n\n${result}`,
          color
        )
      ],
      components: blackjackRows(userId, true)
    });

    return true;
  }

  if (customId.startsWith("ttt:")) {
    const [, gameId, indexText] = customId.split(":");
    const game = activeTicTacToe.get(gameId);

    if (!game || interaction.user.id !== game.userId) {
      await interaction.reply({
        content: "❌ זה לא המשחק שלך.",
        ephemeral: true
      });

      return true;
    }

    const index = Number(indexText);

    if (game.board[index]) {
      await interaction.reply({
        content: "❌ המשבצת תפוסה.",
        ephemeral: true
      });

      return true;
    }

    game.board[index] = "X";

    let gameWinner = winner(game.board);

    if (!gameWinner) {
      const move = botMove(game);

      if (move !== undefined) {
        game.board[move] = "O";
      }

      gameWinner = winner(game.board);
    }

    if (gameWinner) {
      const data = loadData();
      const userData = getUser(data, game.userId);

      activeTicTacToe.delete(game.id);

      let result;
      let color;

      if (gameWinner === "X") {
        const payout = game.amount * 2;
        addWin(userData, payout);
        result = `🏆 ניצחת וזכית ב־${money(payout)} שקלים.`;
        color = "Green";
      } else if (gameWinner === "draw") {
        addWin(userData, game.amount);
        result = "➖ תיקו. ההימור הוחזר.";
        color = "Gold";
      } else {
        addLoss(userData, game.amount);
        result = `🤖 הבוט ניצח. הפסדת ${money(game.amount)} שקלים.`;
        color = "Red";
      }

      saveData(data);

      await interaction.update({
        embeds: [
          makeEmbed("❌⭕ איקס עיגול", result, color)
        ],
        components: tttRows(game, true)
      });

      return true;
    }

    await interaction.update({
      embeds: [
        makeEmbed(
          "❌⭕ איקס עיגול",
          "אתה X והבוט O. התור שלך."
        )
      ],
      components: tttRows(game)
    });

    return true;
  }

  return false;
}

module.exports = {
  commands: [
    balance,
    daily,
    weekly,
    monthly,
    stats,
    leaderboard,
    coinflip,
    roulette,
    horserace,
    crash,
    mines,
    blackjack,
    tictactoe,
    addmoney,
    removemoney
  ],

  handleButton
};