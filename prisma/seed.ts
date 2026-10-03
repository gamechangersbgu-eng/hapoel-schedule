import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEAM_NAMES = [
  "נוער",
  "נערים א",
  "נערים ב",
  "נערים ג",
  "ילדים א",
  "ילדים ב",
  "ילדים ב ל",
  "ילדים ג",
  "ילדים ג ל",
  "טרום א",
  "טרום א ל",
  "טרום ב",
  "טרום ב ל",
  "טרום ג",
  "בית ספר",
  "מ.קייץ",
];

function atNoon(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function formatISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sundayOf(date: Date) {
  const copy = atNoon(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = atNoon(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

async function main() {
  await prisma.slot.deleteMany();
  await prisma.team.deleteMany();
  await prisma.settings.deleteMany();

  await prisma.settings.create({
    data: {
      id: 1,
      clubName: "הפועל באר שבע",
      seasonStartDate: "2026-06-28",
    },
  });

  const teams = await Promise.all(
    TEAM_NAMES.map((name, index) =>
      prisma.team.create({
        data: { name, sortOrder: index, isComments: false },
      }),
    ),
  );

  const comments = await prisma.team.create({
    data: {
      name: "הערות",
      sortOrder: TEAM_NAMES.length,
      isComments: true,
    },
  });

  const byName = Object.fromEntries(teams.map((team) => [team.name, team]));
  const weekStart = formatISODate(sundayOf(new Date()));
  const d = (offset: number) => addDaysISO(weekStart, offset);

  const slots: Array<{
    teamName: string;
    dateOffset: number;
    endOffset?: number;
    startTime?: string;
    type: string;
    note?: string;
  }> = [
    { teamName: "נוער", dateOffset: 0, startTime: "09:00", type: "vasermil_1" },
    { teamName: "נוער", dateOffset: 0, startTime: "19:30", type: "vasermil_1" },
    { teamName: "נוער", dateOffset: 1, startTime: "19:30", type: "vasermil_1" },
    { teamName: "נוער", dateOffset: 3, startTime: "19:30", type: "vasermil_2" },
    { teamName: "נוער", dateOffset: 6, startTime: "20:00", type: "home_game", note: "ליגה" },

    { teamName: "נערים א", dateOffset: 0, startTime: "18:00", type: "vasermil_2" },
    { teamName: "נערים א", dateOffset: 2, startTime: "18:00", type: "vasermil_2" },
    { teamName: "נערים א", dateOffset: 4, startTime: "18:00", type: "vasermil_1" },
    { teamName: "נערים א", dateOffset: 6, startTime: "11:00", type: "away_game" },

    { teamName: "נערים ב", dateOffset: 0, startTime: "16:30", type: "vasermil_3" },
    { teamName: "נערים ב", dateOffset: 2, startTime: "16:30", type: "vasermil_3" },
    { teamName: "נערים ב", dateOffset: 4, startTime: "16:30", type: "vasermil_3" },

    { teamName: "נערים ג", dateOffset: 1, startTime: "17:00", type: "vasermil_4" },
    { teamName: "נערים ג", dateOffset: 3, startTime: "17:00", type: "vasermil_4" },
    { teamName: "נערים ג", dateOffset: 5, type: "off", note: "חופש" },

    { teamName: "ילדים א", dateOffset: 0, startTime: "17:00", type: "vasermil_1" },
    { teamName: "ילדים א", dateOffset: 2, startTime: "17:00", type: "vasermil_1" },
    { teamName: "ילדים א", dateOffset: 4, startTime: "17:00", type: "vasermil_2" },

    { teamName: "ילדים ב", dateOffset: 1, startTime: "16:00", type: "vasermil_2" },
    { teamName: "ילדים ב", dateOffset: 3, startTime: "16:00", type: "vasermil_2" },

    { teamName: "ילדים ב ל", dateOffset: 1, startTime: "16:00", type: "vasermil_3" },
    { teamName: "ילדים ב ל", dateOffset: 4, startTime: "16:00", type: "vasermil_3" },

    { teamName: "ילדים ג", dateOffset: 0, startTime: "17:30", type: "vasermil_4" },
    { teamName: "ילדים ג", dateOffset: 3, startTime: "17:30", type: "vasermil_4" },

    { teamName: "ילדים ג ל", dateOffset: 2, startTime: "15:30", type: "vasermil_1" },
    { teamName: "ילדים ג ל", dateOffset: 4, startTime: "15:30", type: "vasermil_1" },

    { teamName: "טרום א", dateOffset: 0, startTime: "17:00", type: "vasermil_3", note: "התרשמות" },
    { teamName: "טרום א", dateOffset: 2, startTime: "17:00", type: "vasermil_3" },

    { teamName: "טרום א ל", dateOffset: 1, startTime: "16:30", type: "vasermil_4" },
    { teamName: "טרום א ל", dateOffset: 4, startTime: "16:30", type: "vasermil_4" },

    { teamName: "טרום ב", dateOffset: 0, startTime: "16:00", type: "vasermil_1" },
    { teamName: "טרום ב", dateOffset: 3, startTime: "16:00", type: "vasermil_1" },

    { teamName: "טרום ב ל", dateOffset: 2, startTime: "15:00", type: "vasermil_2" },
    { teamName: "טרום ב ל", dateOffset: 4, startTime: "15:00", type: "vasermil_2" },

    { teamName: "טרום ג", dateOffset: 1, endOffset: 3, type: "camp", note: "מחנה אימון" },

    { teamName: "בית ספר", dateOffset: 5, startTime: "09:00", type: "other", note: "אימון בית ספר" },

    { teamName: "מ.קייץ", dateOffset: 0, type: "off", note: "סיום מחנה" },
  ];

  await prisma.slot.createMany({
    data: slots.map((slot) => ({
      teamId: byName[slot.teamName].id,
      date: d(slot.dateOffset),
      endDate: slot.endOffset != null ? d(slot.endOffset) : null,
      startTime: slot.startTime ?? null,
      type: slot.type,
      note: slot.note ?? null,
    })),
  });

  await prisma.slot.create({
    data: {
      teamId: comments.id,
      date: d(6),
      type: "other",
      note: "משחקי בית בשבת — להגיע שעה לפני. עדכון אחרון באתר.",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
