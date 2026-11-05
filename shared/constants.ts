/** Re-export lookup codes by domain (`shared/<domain>.ts`). */
export {
  TEAM_AGE_BAND_CODES,
  STAFF_UNAVAILABILITY_TYPES,
  type TeamAgeBandCode,
  type StaffUnavailabilityType,
} from "./team";
export {
  PITCH_CODES,
  PITCH_SUBDIVISION_CODES,
  type PitchCode,
  type PitchSubdivisionCode,
} from "./pitch";
export { TRAINING_DURATION_MINUTES, type TrainingDurationMinutes } from "./practice";
export { SLOT_KINDS, EXTERNAL_EVENT_TYPES, type SlotKind, type ExternalEventType } from "./game";
