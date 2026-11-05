/** Re-export Ref/DTO types by domain (`shared/<domain>.ts`). */
export type { PitchRef, PitchSubdivisionRef } from "./pitch";
export type {
  RotationTemplateRef,
  TeamAgeBandRef,
  FootballSchoolRuleRef,
  SlotTrainingDetailsRef,
} from "./practice";
export type { CityRef, SlotGameDetailsRef, ExternalEventRef } from "./game";
export type {
  StaffMemberRef,
  StaffUnavailabilityRef,
  MedicRef,
  DriverRef,
} from "./personnel";
