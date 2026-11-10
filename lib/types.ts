export type SlotDTO = {
  id: number;
  teamId: number;
  date: string;
  endDate: string | null;
  startTime: string | null;
  type: string;
  note: string | null;
  /** "cancelled" when the session or game was called off (shown crossed out). */
  status?: string;
  /** Reason shown to parents, e.g. "המאמן חולה". */
  statusNote?: string | null;
  /** Name of the substitute coach for this session, if any. */
  substituteName?: string | null;
  /** Part of the pitch for trainings, e.g. "½ צפון" (absent = whole pitch / unknown). */
  place?: string | null;
  /** Saved training length, used to restore שעת סיום in the editor. */
  durationMinutes?: number | null;
  /** Chosen סבב, when the training was booked from one. */
  rotationTemplateId?: number | null;
  /** Clock end, derived from start + duration when a length was saved. */
  endTime?: string | null;
  /** Games: opponent, and for away games the departure time from Beer Sheva. */
  opponent?: string | null;
  departureTime?: string | null;
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
