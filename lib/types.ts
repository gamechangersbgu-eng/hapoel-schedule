export type SlotDTO = {
  id: number;
  teamId: number;
  date: string;
  endDate: string | null;
  startTime: string | null;
  type: string;
  note: string | null;
};

export type TeamDTO = {
  id: number;
  name: string;
  sortOrder: number;
  isComments: boolean;
};

export type WeekData = {
  clubName: string;
  seasonStartDate: string;
  weekStart: string;
  weekNumber: number;
  dates: string[];
  teams: TeamDTO[];
  slots: SlotDTO[];
};
