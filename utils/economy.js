const fs = require("fs");
const path = require("path");

// =====================
// CONFIG
// =====================

const DATA_FILE = path.join(
  __dirname,
  "..",
  "casinoData.json"
);

const START_MONEY = 1000;
const MIN_BET = 10;
const MAX_BET = 250000;

const JAIL_TIME = 60 * 60 * 1000;
const MAX_SALARY_HOURS = 24;

// =====================
// JOBS
// =====================

const JOBS = {
  cashier: {
    id: "cashier",
    name: "קופאי",
    emoji: "💵",
    salaryPerHour: 7
  },

  bartender: {
    id: "bartender",
    name: "ברמן",
    emoji: "🍺",
    salaryPerHour: 15
  },

  barber: {
    id: "barber",
    name: "ספר",
    emoji: "✂️",
    salaryPerHour: 80
  },

  realestate: {
    id: "realestate",
    name: 'נדל"ן',
    emoji: "🏢",
    salaryPerHour: 120
  },

  hightech: {
    id: "hightech",
    name: "הייטק",
    emoji: "💻",
    salaryPerHour: 150
  },

  carpentry: {
    id: "carpentry",
    name: "נגרות",
    emoji: "🪚",
    salaryPerHour: 60
  }
};

// =====================
// DATA
// =====================

function ensureDataFile() {
  const directory = path.dirname(DATA_FILE);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({}, null, 2),
      "utf8"
    );
  }
}

function loadData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    if (!raw.trim()) {
      return {};
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      "❌ שגיאה בקריאת casinoData.json:",
      error
    );

    return {};
  }
}

function saveData(data) {
  ensureDataFile();

  try {
    const temporaryFile =
      `${DATA_FILE}.tmp`;

    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    fs.renameSync(
      temporaryFile,
      DATA_FILE
    );

    return true;
  } catch (error) {
    console.error(
      "❌ שגיאה בשמירת casinoData.json:",
      error
    );

    return false;
  }
}

// =====================
// USERS
// =====================

function createDefaultUser() {
  return {
    money: START_MONEY,

    gamesPlayed: 0,
    totalBet: 0,
    totalWon: 0,
    totalLost: 0,
    biggestWin: 0,

    lastDaily: 0,
    lastWeekly: 0,
    lastMonthly: 0,

    jobId: null,
    jobStartedAt: 0,
    lastSalaryClaim: 0,
    totalSalaryEarned: 0,

    jailedUntil: 0,
    timesArrested: 0,

    successfulSteals: 0,
    failedSteals: 0,
    totalStolen: 0,
    totalLostToTheft: 0,

    totalSent: 0,
    totalReceived: 0
  };
}

function normalizeUser(user) {
  const defaults = createDefaultUser();

  for (const [key, value] of Object.entries(defaults)) {
    if (user[key] === undefined) {
      user[key] = value;
    }
  }

  if (!Number.isFinite(user.money)) {
    user.money = START_MONEY;
  }

  if (user.money < 0) {
    user.money = 0;
  }

  return user;
}

function getUser(data, userId) {
  if (!data[userId]) {
    data[userId] = createDefaultUser();
  }

  return normalizeUser(data[userId]);
}

// =====================
// FORMATTING
// =====================

function money(amount) {
  return Number(amount || 0)
    .toLocaleString("he-IL");
}

function formatDuration(milliseconds) {
  const safeTime = Math.max(
    0,
    Number(milliseconds || 0)
  );

  const totalMinutes = Math.ceil(
    safeTime / 60000
  );

  const days = Math.floor(
    totalMinutes / 1440
  );

  const hours = Math.floor(
    (totalMinutes % 1440) / 60
  );

  const minutes =
    totalMinutes % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days} ימים`);
  }

  if (hours > 0) {
    parts.push(`${hours} שעות`);
  }

  if (
    minutes > 0 ||
    parts.length === 0
  ) {
    parts.push(`${minutes} דקות`);
  }

  return parts.join(" ו־");
}

// =====================
// JAIL
// =====================

function isInJail(userData) {
  return Number(userData.jailedUntil || 0) >
    Date.now();
}

function getJailTimeLeft(userData) {
  return Math.max(
    0,
    Number(userData.jailedUntil || 0) -
      Date.now()
  );
}

function jailUser(
  userData,
  duration = JAIL_TIME
) {
  const now = Date.now();

  const currentEnd = Math.max(
    now,
    Number(userData.jailedUntil || 0)
  );

  userData.jailedUntil =
    currentEnd + duration;

  userData.timesArrested =
    Number(userData.timesArrested || 0) + 1;

  return userData.jailedUntil;
}

function releaseUser(userData) {
  userData.jailedUntil = 0;
}

function jailError(userData) {
  if (!isInJail(userData)) {
    return null;
  }

  return (
    `🚔 אתה נמצא בכלא.\n` +
    `תוכל להשתמש שוב בקזינו בעוד **${formatDuration(
      getJailTimeLeft(userData)
    )}**.`
  );
}

// =====================
// BETTING
// =====================

function validateBet(
  userData,
  amount
) {
  const jailMessage =
    jailError(userData);

  if (jailMessage) {
    return jailMessage;
  }

  if (!Number.isInteger(amount)) {
    return "❌ סכום ההימור חייב להיות מספר שלם.";
  }

  if (amount < MIN_BET) {
    return (
      `❌ מינימום הימור הוא ` +
      `**${money(MIN_BET)} שקלים**.`
    );
  }

  if (amount > MAX_BET) {
    return (
      `❌ מקסימום הימור הוא ` +
      `**${money(MAX_BET)} שקלים**.`
    );
  }

  if (userData.money < amount) {
    return (
      `❌ אין לך מספיק שקלים.\n` +
      `יתרה נוכחית: ` +
      `**${money(userData.money)} שקלים**.`
    );
  }

  return null;
}

function placeBet(
  userData,
  amount
) {
  userData.money -= amount;
  userData.totalBet += amount;
  userData.gamesPlayed += 1;

  if (userData.money < 0) {
    userData.money = 0;
  }
}

function addWin(
  userData,
  payout
) {
  const safePayout = Math.max(
    0,
    Math.floor(Number(payout || 0))
  );

  userData.money += safePayout;
  userData.totalWon += safePayout;

  if (
    safePayout >
    Number(userData.biggestWin || 0)
  ) {
    userData.biggestWin =
      safePayout;
  }
}

function addLoss(
  userData,
  amount
) {
  const safeAmount = Math.max(
    0,
    Math.floor(Number(amount || 0))
  );

  userData.totalLost += safeAmount;
}

// =====================
// JOBS
// =====================

function getJob(jobId) {
  return JOBS[jobId] || null;
}

function getAllJobs() {
  return Object.values(JOBS);
}

function setJob(
  userData,
  jobId
) {
  const job = getJob(jobId);

  if (!job) {
    return {
      success: false,
      error: "❌ העבודה הזאת לא קיימת."
    };
  }

  const now = Date.now();

  userData.jobId = job.id;
  userData.jobStartedAt = now;
  userData.lastSalaryClaim = now;

  return {
    success: true,
    job
  };
}

function removeJob(userData) {
  userData.jobId = null;
  userData.jobStartedAt = 0;
  userData.lastSalaryClaim = 0;
}

function calculateSalary(
  userData,
  now = Date.now()
) {
  const job = getJob(
    userData.jobId
  );

  if (!job) {
    return {
      success: false,
      error: "❌ עדיין לא בחרת עבודה."
    };
  }

  const startTime =
    Number(
      userData.lastSalaryClaim ||
      userData.jobStartedAt ||
      now
    );

  const elapsed =
    Math.max(0, now - startTime);

  const maxElapsed =
    MAX_SALARY_HOURS *
    60 *
    60 *
    1000;

  const cappedElapsed =
    Math.min(elapsed, maxElapsed);

  const exactHours =
    cappedElapsed /
    (60 * 60 * 1000);

  const fullHours =
    Math.floor(exactHours);

  const salary =
    fullHours *
    job.salaryPerHour;

  return {
    success: true,
    job,
    salary,
    fullHours,
    exactHours,
    cappedElapsed,
    maxHours: MAX_SALARY_HOURS
  };
}

function claimSalary(
  userData,
  now = Date.now()
) {
  const jailMessage =
    jailError(userData);

  if (jailMessage) {
    return {
      success: false,
      error: jailMessage
    };
  }

  const result =
    calculateSalary(userData, now);

  if (!result.success) {
    return result;
  }

  if (result.fullHours < 1) {
    const lastClaim = Number(
      userData.lastSalaryClaim ||
      userData.jobStartedAt ||
      now
    );

    const nextHour =
      lastClaim +
      60 * 60 * 1000;

    return {
      success: false,
      error:
        `⏳ עדיין לא עברה שעה מלאה.\n` +
        `תוכל לאסוף משכורת בעוד **${formatDuration(
          nextHour - now
        )}**.`
    };
  }

  userData.money += result.salary;
  userData.totalSalaryEarned +=
    result.salary;

  userData.lastSalaryClaim =
    now;

  return {
    success: true,
    ...result,
    newBalance: userData.money
  };
}

// =====================
// TRANSFERS
// =====================

function validateTransfer(
  senderData,
  receiverId,
  senderId,
  amount
) {
  const jailMessage =
    jailError(senderData);

  if (jailMessage) {
    return jailMessage;
  }

  if (
    receiverId === senderId
  ) {
    return "❌ אי אפשר להעביר כסף לעצמך.";
  }

  if (
    !Number.isInteger(amount) ||
    amount < 1
  ) {
    return "❌ סכום ההעברה חייב להיות לפחות שקל אחד.";
  }

  if (
    senderData.money < amount
  ) {
    return (
      `❌ אין לך מספיק שקלים להעברה.\n` +
      `יתרה נוכחית: ` +
      `**${money(senderData.money)} שקלים**.`
    );
  }

  return null;
}

function transferMoney(
  senderData,
  receiverData,
  amount
) {
  const safeAmount = Math.max(
    0,
    Math.floor(Number(amount || 0))
  );

  if (
    safeAmount < 1 ||
    senderData.money < safeAmount
  ) {
    return false;
  }

  senderData.money -= safeAmount;
  receiverData.money += safeAmount;

  senderData.totalSent +=
    safeAmount;

  receiverData.totalReceived +=
    safeAmount;

  return true;
}

// =====================
// STEAL
// =====================

function calculateStealAmount(
  victimData
) {
  const victimMoney = Math.max(
    0,
    Number(victimData.money || 0)
  );

  if (victimMoney < 10) {
    return 0;
  }

  const maximum = Math.max(
    10,
    Math.min(
      5000,
      Math.floor(victimMoney * 0.25)
    )
  );

  const minimum = Math.min(
    maximum,
    Math.max(
      5,
      Math.floor(victimMoney * 0.03)
    )
  );

  return Math.floor(
    Math.random() *
      (maximum - minimum + 1)
  ) + minimum;
}

function attemptSteal(
  thiefData,
  victimData,
  options = {}
) {
  const jailMessage =
    jailError(thiefData);

  if (jailMessage) {
    return {
      success: false,
      jailed: true,
      error: jailMessage
    };
  }

  if (
    Number(victimData.money || 0) <
    10
  ) {
    return {
      success: false,
      jailed: false,
      error:
        "❌ למשתמש הזה אין מספיק כסף שאפשר לגנוב."
    };
  }

  const successChance =
    Number(
      options.successChance ?? 0.55
    );

  const caught =
    Math.random() >= successChance;

  if (caught) {
    thiefData.failedSteals += 1;

    jailUser(
      thiefData,
      options.jailTime || JAIL_TIME
    );

    const fine = Math.min(
      thiefData.money,
      Math.max(
        25,
        Math.floor(
          thiefData.money * 0.1
        )
      )
    );

    thiefData.money -= fine;
    thiefData.totalLost += fine;

    return {
      success: false,
      jailed: true,
      fine,
      jailTime: getJailTimeLeft(
        thiefData
      )
    };
  }

  const stolenAmount =
    calculateStealAmount(victimData);

  victimData.money -= stolenAmount;
  thiefData.money += stolenAmount;

  thiefData.successfulSteals += 1;
  thiefData.totalStolen +=
    stolenAmount;

  victimData.totalLostToTheft +=
    stolenAmount;

  return {
    success: true,
    jailed: false,
    stolenAmount
  };
}

// =====================
// EXPORTS
// =====================

module.exports = {
  DATA_FILE,

  START_MONEY,
  MIN_BET,
  MAX_BET,
  JAIL_TIME,
  MAX_SALARY_HOURS,
  JOBS,

  loadData,
  saveData,
  getUser,
  createDefaultUser,
  normalizeUser,

  money,
  formatDuration,

  isInJail,
  getJailTimeLeft,
  jailUser,
  releaseUser,
  jailError,

  validateBet,
  placeBet,
  addWin,
  addLoss,

  getJob,
  getAllJobs,
  setJob,
  removeJob,
  calculateSalary,
  claimSalary,

  validateTransfer,
  transferMoney,

  calculateStealAmount,
  attemptSteal
};
