/** Demo practices and games for the current week + the following week (14 days). */

export type DemoSlotSpec = {
  teamName: string;
  /** Days from Sunday of current week (0–13). */
  dayOffset: number;
  endDayOffset?: number;
  startTime?: string;
  type: string;
  note?: string;
  game?: {
    opponent: string;
    kickoffTime: string;
    pitchCode?: "vasermil_1" | "vasermil_3" | "vasermil_4";
    cityName?: string;
    externalId: string;
  };
};

export const DEMO_TWO_WEEK_SLOTS: DemoSlotSpec[] = [
  // --- Week 1 (days 0–6) — practices ---
  { teamName: "נוער", dayOffset: 0, startTime: "09:00", type: "vasermil_1" },
  { teamName: "נוער", dayOffset: 0, startTime: "19:30", type: "vasermil_1" },
  { teamName: "נוער", dayOffset: 1, startTime: "19:30", type: "vasermil_1" },
  { teamName: "נוער", dayOffset: 3, startTime: "19:30", type: "vasermil_2" },
  {
    teamName: "נוער",
    dayOffset: 6,
    startTime: "20:00",
    type: "home_game",
    note: "ליגת נוער",
    game: {
      opponent: "מ.ס. אשדוד",
      kickoffTime: "20:00",
      pitchCode: "vasermil_1",
      externalId: "demo-w1-noar-home",
    },
  },

  { teamName: "נערים א", dayOffset: 0, startTime: "18:00", type: "vasermil_2" },
  { teamName: "נערים א", dayOffset: 2, startTime: "18:00", type: "vasermil_2" },
  { teamName: "נערים א", dayOffset: 4, startTime: "18:00", type: "vasermil_1" },
  {
    teamName: "נערים א",
    dayOffset: 6,
    startTime: "11:00",
    type: "away_game",
    game: {
      opponent: "הפועל תל אביב",
      kickoffTime: "11:00",
      cityName: "תל אביב",
      externalId: "demo-w1-na-away",
    },
  },

  { teamName: "נערים ב", dayOffset: 0, startTime: "16:30", type: "vasermil_3" },
  { teamName: "נערים ב", dayOffset: 2, startTime: "16:30", type: "vasermil_3" },
  { teamName: "נערים ב", dayOffset: 4, startTime: "16:30", type: "vasermil_3" },
  {
    teamName: "נערים ב",
    dayOffset: 5,
    startTime: "17:30",
    type: "home_game",
    game: {
      opponent: "מ.כ. באר שבע",
      kickoffTime: "17:30",
      pitchCode: "vasermil_3",
      externalId: "demo-w1-nb-home",
    },
  },

  { teamName: "נערים ג", dayOffset: 1, startTime: "17:00", type: "vasermil_4" },
  { teamName: "נערים ג", dayOffset: 3, startTime: "17:00", type: "vasermil_4" },
  { teamName: "נערים ג", dayOffset: 5, type: "off", note: "חופש" },

  { teamName: "ילדים א", dayOffset: 0, startTime: "17:00", type: "vasermil_1" },
  { teamName: "ילדים א", dayOffset: 2, startTime: "17:00", type: "vasermil_1" },
  { teamName: "ילדים א", dayOffset: 4, startTime: "17:00", type: "vasermil_2" },

  { teamName: "ילדים ב", dayOffset: 1, startTime: "16:00", type: "vasermil_2" },
  { teamName: "ילדים ב", dayOffset: 3, startTime: "16:00", type: "vasermil_2" },
  {
    teamName: "ילדים ב",
    dayOffset: 6,
    startTime: "09:30",
    type: "away_game",
    game: {
      opponent: "הפועל חדרה",
      kickoffTime: "09:30",
      cityName: "חדרה",
      externalId: "demo-w1-yb-away",
    },
  },

  { teamName: "ילדים ב ל", dayOffset: 1, startTime: "16:00", type: "vasermil_3" },
  { teamName: "ילדים ב ל", dayOffset: 4, startTime: "16:00", type: "vasermil_3" },

  { teamName: "ילדים ג", dayOffset: 0, startTime: "17:30", type: "vasermil_4" },
  { teamName: "ילדים ג", dayOffset: 3, startTime: "17:30", type: "vasermil_4" },

  { teamName: "ילדים ג ל", dayOffset: 2, startTime: "15:30", type: "vasermil_1" },
  { teamName: "ילדים ג ל", dayOffset: 4, startTime: "15:30", type: "vasermil_1" },

  { teamName: "טרום א", dayOffset: 0, startTime: "17:00", type: "vasermil_3", note: "התרשמות" },
  { teamName: "טרום א", dayOffset: 2, startTime: "17:00", type: "vasermil_3" },

  { teamName: "טרום א ל", dayOffset: 1, startTime: "16:30", type: "vasermil_4" },
  { teamName: "טרום א ל", dayOffset: 4, startTime: "16:30", type: "vasermil_4" },

  { teamName: "טרום ב", dayOffset: 0, startTime: "16:00", type: "vasermil_1" },
  { teamName: "טרום ב", dayOffset: 3, startTime: "16:00", type: "vasermil_1" },

  { teamName: "טרום ב ל", dayOffset: 2, startTime: "15:00", type: "vasermil_2" },
  { teamName: "טרום ב ל", dayOffset: 4, startTime: "15:00", type: "vasermil_2" },

  { teamName: "טרום ג", dayOffset: 1, endDayOffset: 3, type: "camp", note: "מחנה אימון" },

  { teamName: "בית ספר", dayOffset: 5, startTime: "09:00", type: "other", note: "אימון בית ספר" },
  { teamName: "מ.קייץ", dayOffset: 0, type: "off", note: "סיום מחנה" },

  // --- Week 2 (days 7–13) ---
  { teamName: "נוער", dayOffset: 7, startTime: "19:30", type: "vasermil_1" },
  { teamName: "נוער", dayOffset: 9, startTime: "19:30", type: "vasermil_2" },
  {
    teamName: "נוער",
    dayOffset: 13,
    startTime: "19:00",
    type: "away_game",
    game: {
      opponent: "מ.ס. חיפה",
      kickoffTime: "19:00",
      cityName: "חיפה",
      externalId: "demo-w2-noar-away",
    },
  },

  { teamName: "נערים א", dayOffset: 7, startTime: "18:00", type: "vasermil_2" },
  { teamName: "נערים א", dayOffset: 10, startTime: "18:00", type: "vasermil_1" },
  {
    teamName: "נערים א",
    dayOffset: 12,
    startTime: "20:15",
    type: "home_game",
    game: {
      opponent: "מ.כ. גבעתיים",
      kickoffTime: "20:15",
      pitchCode: "vasermil_1",
      externalId: "demo-w2-na-home",
    },
  },

  { teamName: "נערים ב", dayOffset: 8, startTime: "16:30", type: "vasermil_3" },
  { teamName: "נערים ב", dayOffset: 11, startTime: "16:30", type: "vasermil_3" },

  { teamName: "נערים ג", dayOffset: 7, startTime: "17:00", type: "vasermil_4" },
  { teamName: "נערים ג", dayOffset: 9, startTime: "17:00", type: "vasermil_4" },

  { teamName: "ילדים א", dayOffset: 8, startTime: "17:00", type: "vasermil_1" },
  { teamName: "ילדים א", dayOffset: 10, startTime: "17:00", type: "vasermil_2" },
  {
    teamName: "ילדים א",
    dayOffset: 13,
    startTime: "10:00",
    type: "home_game",
    game: {
      opponent: "מ.ס. דימונה",
      kickoffTime: "10:00",
      pitchCode: "vasermil_4",
      externalId: "demo-w2-ya-home",
    },
  },

  { teamName: "ילדים ב", dayOffset: 7, startTime: "16:00", type: "vasermil_2" },
  { teamName: "ילדים ב", dayOffset: 9, startTime: "16:00", type: "vasermil_2" },

  { teamName: "ילדים ג", dayOffset: 8, startTime: "17:30", type: "vasermil_4" },
  { teamName: "ילדים ג ל", dayOffset: 11, startTime: "15:30", type: "vasermil_1" },

  { teamName: "טרום א", dayOffset: 7, startTime: "17:00", type: "vasermil_3" },
  { teamName: "טרום ב", dayOffset: 10, startTime: "16:00", type: "vasermil_1" },

  { teamName: "בית ספר", dayOffset: 8, startTime: "16:30", type: "vasermil_2", note: "ימי א–ד בית ספר" },
  { teamName: "בית ספר", dayOffset: 12, startTime: "17:00", type: "other", note: "ליגה פנימית" },
];
