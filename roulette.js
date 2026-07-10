const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const {
  loadData,
  saveData,
  getUser,
  money,
  validateBet,
  placeBet,
  addWin,
  addLoss
} = require("../utils/economy");

function makeEmbed(title, description, color = "Gold") {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

function rouletteColor(number) {
  if (number === 0) return "green";

  const redNumbers = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36
  ]);

  return redNumbers.has(number) ? "red" : "black";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("רולטה")
    .addStringOption(option =>
      option
        .setName("bet")
        .setDescription("סוג הימור")
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
        .setDescription("סכום הימור")
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);

    const bet = interaction.options.getString("bet");
    const amount = interaction.options.getInteger("amount");

    const error = validateBet(userData, amount);

    if (error) {
      return interaction.reply({
        content: error,
        ephemeral: true
      });
    }

    placeBet(userData, amount);

    const number = Math.floor(Math.random() * 37);
    const color = rouletteColor(number);

    let won = false;
    let multiplier = 2;

    if (bet === "red" && color === "red") won = true;
    if (bet === "black" && color === "black") won = true;

    if (bet === "green" && color === "green") {
      won = true;
      multiplier = 14;
    }

    if (bet === "even" && number !== 0 && number % 2 === 0) won = true;
    if (bet === "odd" && number % 2 === 1) won = true;
    if (bet === "low" && number >= 1 && number <= 18) won = true;
    if (bet === "high" && number >= 19 && number <= 36) won = true;

    const betNames = {
      red: "אדום",
      black: "שחור",
      green: "ירוק",
      even: "זוגי",
      odd: "אי זוגי",
      low: "נמוך 1-18",
      high: "גבוה 19-36"
    };

    const colorNames = {
      red: "אדום 🔴",
      black: "שחור ⚫",
      green: "ירוק 🟢"
    };

    if (won) {
      const payout = amount * multiplier;

      addWin(userData, payout);
      saveData(data);

      return interaction.reply({
        embeds: [
          makeEmbed(
            "🎡 רולטה",
            `הימור: **${betNames[bet]}**
יצא מספר: **${number}**
צבע: **${colorNames[color]}**

✅ זכית ב־**${money(payout)} שקלים**.
יתרה: **${money(userData.money)} שקלים**.`,
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
          `הימור: **${betNames[bet]}**
יצא מספר: **${number}**
צבע: **${colorNames[color]}**

❌ הפסדת **${money(amount)} שקלים**.
יתרה: **${money(userData.money)} שקלים**.`,
          "Red"
        )
      ]
    });
  }
};