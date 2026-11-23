// Who may open, request, or book the gym and the video room. No database access.
import { hasApproverCapability, isManager, type UserRole } from "@/lib/roles";
import type { RoomKind } from "./room-rules";

export type RoomActor = {
  role: UserRole;
  /** מאמן כושר, assigned on the admin users page. Not a login role. */
  isFitnessCoach: boolean;
};

/** Approver capability: decide requests, and insert a booking without a request. */
export function canApproveRoomRequests(actor: { role: UserRole }) {
  return hasApproverCapability(actor.role);
}

export function canBookRoomDirectly(actor: { role: UserRole }) {
  return canApproveRoomRequests(actor);
}

/** Gym requests: a fitness coach who is not the approver (the approver books directly). */
export function canRequestGym(actor: RoomActor) {
  return actor.isFitnessCoach && !canBookRoomDirectly(actor);
}

/** Video-room requests: any manager who is not the approver. */
export function canRequestVideo(actor: RoomActor) {
  return isManager(actor.role) && !canBookRoomDirectly(actor);
}

export function canSubmitRoomRequest(actor: RoomActor, kind: RoomKind) {
  return kind === "gym" ? canRequestGym(actor) : canRequestVideo(actor);
}

/** Signed-in admin-site users who may open the room screen. */
export function canViewRoom(actor: RoomActor, kind: RoomKind) {
  if (isManager(actor.role)) return true;
  return kind === "gym" && actor.isFitnessCoach;
}
