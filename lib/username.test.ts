import assert from "node:assert/strict";
import test from "node:test";
import { isValidUsername, normalizeUsername, USERNAME_PATTERN } from "./username";

test("usernames are trimmed and lowercased", () => {
  assert.equal(normalizeUsername("  Itay "), "itay");
  assert.equal(normalizeUsername("OMER"), "omer");
  assert.equal(normalizeUsername("\tyoni\n"), "yoni");
});

test("usernames match ^[a-z0-9._-]{3,32}$ after normalize", () => {
  assert.equal(USERNAME_PATTERN.source, "^[a-z0-9._-]{3,32}$");
  for (const name of ["itay", "omer", "idan", "raz", "yoni", "tomer", "a.b", "a_b", "a-b", "abc", "a".repeat(32)]) {
    assert.equal(isValidUsername(name), true, name);
  }
  assert.equal(isValidUsername("  Itay.Penso "), true);
  assert.equal(isValidUsername("User_1"), true);
});

test("usernames reject spaces, @, and the wrong length", () => {
  for (const name of ["", " ", "ab", "a".repeat(33), "itay penso", "itay@penso", "itay@club.com", "איתי", "itay!", "itay/penso", "it ay"]) {
    assert.equal(isValidUsername(name), false, JSON.stringify(name));
  }
});
