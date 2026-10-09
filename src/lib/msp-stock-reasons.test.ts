import { describe, expect, it } from "vitest";
import { classifyMspMovement, isGenuineWastage } from "./msp-stock-reasons";

describe("MSP stock movement classification", () => {
 it.each(["Damaged","Out of Date","Expired","Out-of-Date"])("includes genuine wastage: %s", reason => {
   expect(isGenuineWastage(reason)).toBe(true);
 });
 it.each([
  ["Store Use","store_use"],
  ["Stock Correction (+)","stock_adjustment"],
  ["Stock Correction (-)","stock_adjustment"],
  ["Stock Adjustment +","stock_adjustment"],
  ["Stock take corrections +","stock_take"],
  ["Stock take corrections -","stock_take"],
  ["Transfer Out","transfer"],
  ["Consider as Credit Note","credit_note_review"],
  ["Unrecognised Reason","unknown"]
 ] as const)("excludes %s as %s", (reason, expected) => {
  expect(classifyMspMovement(reason)).toBe(expected);
  expect(isGenuineWastage(reason)).toBe(false);
 });
});
