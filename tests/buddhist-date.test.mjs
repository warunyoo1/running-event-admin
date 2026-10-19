import test from "node:test";
import assert from "node:assert/strict";
import { fromBuddhistDate, toBuddhistDate } from "../src/lib/buddhist-date.ts";

test("Buddhist dates preserve ISO values on round-trip", () => {
  assert.equal(toBuddhistDate("2027-01-30"), "30/01/2570");
  for (const date of ["2027-01-30", "2024-02-29", "2026-12-31"]) assert.equal(fromBuddhistDate(toBuddhistDate(date)), date);
  assert.equal(fromBuddhistDate(""), "");
});
test("rejects impossible, incomplete, and accidentally Gregorian input", () => {
  for (const date of ["29/02/2569", "31/04/2570", "30/01/2027", "30/01/257", "00/01/2570"]) assert.equal(fromBuddhistDate(date), null, date);
});
