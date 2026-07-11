const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  loadData,
  saveData,
  getUser,
  money,
  formatDuration,

  getAllJobs,
  getJob,
  setJob,
  claimSalary,

  isInJail,
  getJailTimeLeft,
  jailError,

  validateTransfer,
  transferMoney,

  attemptSteal
} = require("../utils/economy");

// =====================
// ACTIVE CONFIRMATIONS
// =====================

const pendingPayments = new Map();

// האישור יישאר פעיל במשך 2 דקות
const PAYMENT_CONFIRM_TIME = 2 * 60 * 1000;

// זמן המתנה בין ניסיונות גניבה
const STEAL_COOLDOWN = 30 * 60 * 1000;

// =====================
// HELPERS
// =====================

function makeEmbed(title, description, color = "Gold") {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

function createPaymentId(userId) {
  return `${userId}-${Date.now()}`;
}

function getJobEmoji(jobId) {
  return getJob(jobId)?.emoji || "💼";
}

function buildWorkEmbed(userData) {
  const jobs = getAllJobs();

  const jobsText = jobs
    .map(job => {
      return (
        `${job.emoji} **${job.name}**\n` +
        `└ שכר: **${money(job.salaryPerHour)} ₪ לשעה**`
      );
    })
    .join("\n\n");

  const currentJob = getJob(userData.jobId);

  const currentJobText = currentJob
    ? `\n\n💼 העבודה הנוכחית שלך: ${currentJob.emoji} **${currentJob.name}**`
    : "\n\n💼 עדיין אין לך עבודה.";

  return makeEmbed(
    "💼 מרכז התעסוקה",
    `${jobsText}${currentJobText}\n\nלחץ על הכפתור של העבודה שתרצה לבחור.`,
    "Blue"
  );
}

function buildWorkButtons(userData, disabled = false) {
  const jobs = getAllJobs();
  const rows = [];

  for (let index = 0; index < jobs.length; index += 3) {
    const row = new ActionRowBuilder();

    const rowJobs = jobs.slice(index, index + 3);

    for (const job of rowJobs) {
      const isCurrentJob = userData.jobId === job.id;

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`job_select:${job.id}`)
          .setLabel(
            isCurrentJob
              ? `${job.name} - העבודה שלך`
              : job.name
          )
          .setEmoji(job.emoji)
          .setStyle(
            isCurrentJob
              ? ButtonStyle.Success
              : ButtonStyle.Primary
          )
          .setDisabled(disabled || isCurrentJob)
      );
    }

    rows.push(row);
  }

  return rows;
}

function paymentButtons(paymentId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_confirm:${paymentId}`)
        .setLabel("אישור העברה")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId(`pay_cancel:${paymentId}`)
        .setLabel("ביטול")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

// =====================
// WORK
// =====================

const work = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("פתיחת תפריט העבודות"),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);

    const jailMessage = jailError(userData);

    if (jailMessage) {
      return interaction.reply({
        content: jailMessage,
        ephemeral: true
      });
    }

    saveData(data);

    return interaction.reply({
      embeds: [buildWorkEmbed(userData)],
      components: buildWorkButtons(userData),
      ephemeral: true
    });
  }
};

// =====================
// SALARY
// =====================

const salary = {
  data: new SlashCommandBuilder()
    .setName("salary")
    .setDescription("איסוף המשכורת מהעבודה"),

  async execute(interaction) {
    const data = loadData();
    const userData = getUser(data, interaction.user.id);

    const result = claimSalary(userData);

    if (!result.success) {
      return interaction.reply({
        content: result.error,
        ephemeral: true
      });
    }

    saveData(data);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "💵 משכורת נאספה",
          `${result.job.emoji} עבודה: **${result.job.name}**

⏱️ שעות שנאספו: **${result.fullHours}**
💰 שכר לשעה: **${money(result.job.salaryPerHour)} ₪**
💵 קיבלת: **${money(result.salary)} ₪**

יתרה חדשה: **${money(result.newBalance)} ₪**`,
          "Green"
        )
      ]
    });
  }
};

// =====================
// JAIL
// =====================

const jail = {
  data: new SlashCommandBuilder()
    .setName("jail")
    .setDescription("בדיקת מצב הכלא שלך")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("משתמש לבדיקה")
        .setRequired(false)
    ),

  async execute(interaction) {
    const data = loadData();
    const target = interaction.options.getUser("user") || interaction.user;
    const targetData = getUser(data, target.id);

    saveData(data);

    if (!isInJail(targetData)) {
      return interaction.reply({
        embeds: [
          makeEmbed(
            "✅ המשתמש חופשי",
            `${target} לא נמצא כרגע בכלא.`,
            "Green"
          )
        ]
      });
    }

    return interaction.reply({
      embeds: [
        makeEmbed(
          "🚔 המשתמש נמצא בכלא",
          `${target} נמצא בכלא.

⏳ זמן שנותר: **${formatDuration(
            getJailTimeLeft(targetData)
          )}**

בזמן הכלא אי אפשר להמר, לעבוד, לגנוב או להעביר כסף.`,
          "Red"
        )
      ]
    });
  }
};

// =====================
// STEAL
// =====================

const steal = {
  data: new SlashCommandBuilder()
    .setName("steal")
    .setDescription("ניסיון לגנוב שקלים ממשתמש אחר")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("המשתמש שממנו לנסות לגנוב")
        .setRequired(true)
    ),

  async execute(interaction) {
    const data = loadData();

    const target = interaction.options.getUser("user");
    const thiefData = getUser(data, interaction.user.id);
    const victimData = getUser(data, target.id);

    const jailMessage = jailError(thiefData);

    if (jailMessage) {
      return interaction.reply({
        content: jailMessage,
        ephemeral: true
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ אי אפשר לגנוב מעצמך.",
        ephemeral: true
      });
    }

    if (target.bot) {
      return interaction.reply({
        content: "❌ אי אפשר לגנוב מבוט.",
        ephemeral: true
      });
    }

    const now = Date.now();
    const lastSteal = Number(thiefData.lastSteal || 0);

    if (now - lastSteal < STEAL_COOLDOWN) {
      const left = STEAL_COOLDOWN - (now - lastSteal);

      return interaction.reply({
        content:
          `⏳ צריך לחכות לפני ניסיון הגניבה הבא.\n` +
          `נשארו **${formatDuration(left)}**.`,
        ephemeral: true
      });
    }

    thiefData.lastSteal = now;

    const result = attemptSteal(
      thiefData,
      victimData,
      {
        successChance: 0.55
      }
    );

    saveData(data);

    if (result.error) {
      return interaction.reply({
        content: result.error,
        ephemeral: true
      });
    }

    if (result.jailed) {
      return interaction.reply({
        embeds: [
          makeEmbed(
            "🚔 נתפסת!",
            `ניסית לגנוב מ־${target}, אבל המשטרה תפסה אותך.

🔒 נכנסת לכלא למשך: **${formatDuration(
              result.jailTime
            )}**
💸 קנס: **${money(result.fine)} ₪**

בזמן הכלא אי אפשר להשתמש בקזינו, לעבוד, לגנוב או להעביר כסף.`,
            "Red"
          )
        ]
      });
    }

    return interaction.reply({
      embeds: [
        makeEmbed(
          "🕵️ הגניבה הצליחה",
          `הצלחת לגנוב מ־${target}!

💰 גנבת: **${money(result.stolenAmount)} ₪**
💵 היתרה שלך: **${money(thiefData.money)} ₪**`,
          "Green"
        )
      ]
    });
  }
};

// =====================
// PAY
// =====================

const pay = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("העברת שקלים למשתמש אחר")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("המשתמש שיקבל את הכסף")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("כמות השקלים להעברה")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const data = loadData();

    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const senderData = getUser(data, interaction.user.id);

    if (target.bot) {
      return interaction.reply({
        content: "❌ אי אפשר להעביר כסף לבוט.",
        ephemeral: true
      });
    }

    const error = validateTransfer(
      senderData,
      target.id,
      interaction.user.id,
      amount
    );

    if (error) {
      return interaction.reply({
        content: error,
        ephemeral: true
      });
    }

    const paymentId = createPaymentId(interaction.user.id);

    pendingPayments.set(paymentId, {
      id: paymentId,
      senderId: interaction.user.id,
      receiverId: target.id,
      amount,
      createdAt: Date.now(),
      used: false
    });

    setTimeout(() => {
      const payment = pendingPayments.get(paymentId);

      if (payment && !payment.used) {
        pendingPayments.delete(paymentId);
      }
    }, PAYMENT_CONFIRM_TIME);

    return interaction.reply({
      embeds: [
        makeEmbed(
          "⚠️ אישור העברת כסף",
          `אתה עומד להעביר **${money(amount)} ₪** אל ${target}.

⚠️ **הכסף יצא מהכסף האישי שלכם!**

היתרה שלך כרגע: **${money(senderData.money)} ₪**
היתרה לאחר ההעברה: **${money(senderData.money - amount)} ₪**

האם לבצע את ההעברה?`,
          "Orange"
        )
      ],
      components: paymentButtons(paymentId),
      ephemeral: true
    });
  }
};

// =====================
// BUTTON HANDLER
// =====================

async function handleButton(interaction) {
  const customId = interaction.customId;

  // =====================
  // JOB SELECTION
  // =====================

  if (customId.startsWith("job_select:")) {
    const jobId = customId.split(":")[1];

    const data = loadData();
    const userData = getUser(data, interaction.user.id);

    const jailMessage = jailError(userData);

    if (jailMessage) {
      await interaction.reply({
        content: jailMessage,
        ephemeral: true
      });

      return true;
    }

    const result = setJob(userData, jobId);

    if (!result.success) {
      await interaction.reply({
        content: result.error,
        ephemeral: true
      });

      return true;
    }

    saveData(data);

    await interaction.update({
      embeds: [
        makeEmbed(
          "✅ העבודה נבחרה",
          `${result.job.emoji} התחלת לעבוד בתור **${result.job.name}**.

💰 שכר: **${money(result.job.salaryPerHour)} ₪ לשעה**

לאחר שתעבור לפחות שעה, השתמש בפקודה:
\`/salary\`

אפשר לצבור עד 24 שעות של משכורת.`,
          "Green"
        )
      ],
      components: buildWorkButtons(userData, true)
    });

    return true;
  }

  // =====================
  // PAY CANCEL
  // =====================

  if (customId.startsWith("pay_cancel:")) {
    const paymentId = customId.split(":")[1];
    const payment = pendingPayments.get(paymentId);

    if (!payment) {
      await interaction.update({
        content: "❌ הבקשה כבר לא פעילה.",
        embeds: [],
        components: []
      });

      return true;
    }

    if (interaction.user.id !== payment.senderId) {
      await interaction.reply({
        content: "❌ רק מי שפתח את ההעברה יכול לבטל אותה.",
        ephemeral: true
      });

      return true;
    }

    payment.used = true;
    pendingPayments.delete(paymentId);

    await interaction.update({
      embeds: [
        makeEmbed(
          "❌ ההעברה בוטלה",
          "הכסף לא הועבר ולא ירד מהיתרה שלך.",
          "Red"
        )
      ],
      components: paymentButtons(paymentId, true)
    });

    return true;
  }

  // =====================
  // PAY CONFIRM
  // =====================

  if (customId.startsWith("pay_confirm:")) {
    const paymentId = customId.split(":")[1];
    const payment = pendingPayments.get(paymentId);

    if (!payment) {
      await interaction.update({
        content: "❌ בקשת ההעברה פגה או כבר בוצעה.",
        embeds: [],
        components: []
      });

      return true;
    }

    if (interaction.user.id !== payment.senderId) {
      await interaction.reply({
        content: "❌ רק מי שפתח את ההעברה יכול לאשר אותה.",
        ephemeral: true
      });

      return true;
    }

    if (payment.used) {
      await interaction.reply({
        content: "❌ ההעברה הזאת כבר בוצעה.",
        ephemeral: true
      });

      return true;
    }

    if (
      Date.now() - payment.createdAt >
      PAYMENT_CONFIRM_TIME
    ) {
      pendingPayments.delete(paymentId);

      await interaction.update({
        embeds: [
          makeEmbed(
            "⏳ בקשת ההעברה פגה",
            "עבר יותר מדי זמן. פתח העברה חדשה.",
            "Red"
          )
        ],
        components: paymentButtons(paymentId, true)
      });

      return true;
    }

    const data = loadData();
    const senderData = getUser(data, payment.senderId);
    const receiverData = getUser(data, payment.receiverId);

    const error = validateTransfer(
      senderData,
      payment.receiverId,
      payment.senderId,
      payment.amount
    );

    if (error) {
      pendingPayments.delete(paymentId);

      await interaction.update({
        embeds: [
          makeEmbed(
            "❌ ההעברה נכשלה",
            error,
            "Red"
          )
        ],
        components: paymentButtons(paymentId, true)
      });

      return true;
    }

    const success = transferMoney(
      senderData,
      receiverData,
      payment.amount
    );

    if (!success) {
      pendingPayments.delete(paymentId);

      await interaction.update({
        embeds: [
          makeEmbed(
            "❌ ההעברה נכשלה",
            "לא הצלחנו להעביר את הכסף.",
            "Red"
          )
        ],
        components: paymentButtons(paymentId, true)
      });

      return true;
    }

    payment.used = true;
    pendingPayments.delete(paymentId);

    saveData(data);

    await interaction.update({
      embeds: [
        makeEmbed(
          "✅ העברת הכסף הושלמה",
          `העברת **${money(payment.amount)} ₪** אל <@${payment.receiverId}>.

💵 היתרה החדשה שלך: **${money(senderData.money)} ₪**

⚠️ הכסף ירד מהיתרה האישית שלך.`,
          "Green"
        )
      ],
      components: paymentButtons(paymentId, true)
    });

    return true;
  }

  return false;
}

// =====================
// EXPORTS
// =====================

module.exports = {
  commands: [
    work,
    salary,
    jail,
    steal,
    pay
  ],

  handleButton
};
