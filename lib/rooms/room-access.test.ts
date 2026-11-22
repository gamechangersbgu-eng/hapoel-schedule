import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@/lib/roles";
import {
  canApproveRoomRequests,
  canBookRoomDirectly,
  canRequestGym,
  canRequestVideo,
  canSubmitRoomRequest,
  canViewRoom,
  type RoomActor,
} from "./room-access";

function actor(role: UserRole, isFitnessCoach = false): RoomActor {
  return { role, isFitnessCoach };
}

test("the approver is the owner role, not a person's name", () => {
  for (const role of ["owner", "admin", "physio", "coach"] as const) {
    const yes = role === "owner";
    assert.equal(canApproveRoomRequests(actor(role)), yes, role);
    assert.equal(canBookRoomDirectly(actor(role, true)), yes, role);
  }
});

test("gym requests are only for a fitness coach who is not the approver", () => {
  assert.equal(canRequestGym(actor("coach", true)), true);
  assert.equal(canRequestGym(actor("physio", true)), true);
  assert.equal(canRequestGym(actor("admin", true)), true);
  assert.equal(canRequestGym(actor("admin", false)), false);
  assert.equal(canRequestGym(actor("coach", false)), false);
  assert.equal(canRequestGym(actor("owner", true)), false, "the approver books the gym directly");
  assert.equal(canSubmitRoomRequest(actor("coach", true), "gym"), true);
  assert.equal(canSubmitRoomRequest(actor("coach", true), "video"), false);
  assert.equal(canSubmitRoomRequest(actor("admin", false), "gym"), false);
});

test("video requests are for managers who are not the approver", () => {
  assert.equal(canRequestVideo(actor("admin")), true);
  assert.equal(canRequestVideo(actor("admin", true)), true);
  assert.equal(canRequestVideo(actor("owner")), false);
  assert.equal(canRequestVideo(actor("coach", true)), false);
  assert.equal(canRequestVideo(actor("physio")), false);
  assert.equal(canSubmitRoomRequest(actor("admin"), "video"), true);
});

test("room pages stay inside the signed-in admin site", () => {
  assert.equal(canViewRoom(actor("owner"), "gym"), true);
  assert.equal(canViewRoom(actor("admin"), "video"), true);
  assert.equal(canViewRoom(actor("coach", true), "gym"), true);
  assert.equal(canViewRoom(actor("coach", true), "video"), false);
  assert.equal(canViewRoom(actor("physio", true), "gym"), true);
  assert.equal(canViewRoom(actor("physio", true), "video"), false);
  assert.equal(canViewRoom(actor("coach"), "gym"), false);
  assert.equal(canViewRoom(actor("physio"), "video"), false);
});
