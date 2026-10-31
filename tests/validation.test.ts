import { describe, expect, test } from "bun:test";
import { sprintInput, taskInput } from "../lib/validation";
const task = { sprintId: null, title: "Laporan bulanan", description: "", category: "", priority: "medium", status: "todo", blocker: "", steps: [{ title: "Periksa angka", done: false }] };
describe("Integrity rules for report editing", () => {
  test("backlog cannot contain completed work", () => {
    expect(taskInput.safeParse({ ...task, steps: [{ title: "Periksa angka", done: true }] }).success).toBe(false);
    expect(taskInput.safeParse({ ...task, status: "in_progress" }).success).toBe(false);
  });
  test("completed tasks require every step finished", () => {
    expect(taskInput.safeParse({ ...task, sprintId: 1, status: "done" }).success).toBe(false);
    expect(taskInput.safeParse({ ...task, sprintId: 1, status: "done", steps: [{ title: "Periksa angka", done: true }] }).success).toBe(true);
  });
  test("blocked work requires an actionable explanation", () => {
    expect(taskInput.safeParse({ ...task, sprintId: 1, status: "blocked" }).success).toBe(false);
    expect(taskInput.safeParse({ ...task, sprintId: 1, status: "blocked", blocker: "Menunggu akses layanan" }).success).toBe(true);
  });
  test("invalid dates and reversed sprint periods are rejected", () => {
    const sprint = { number: 19, title: "Sprint berikutnya", startDate: "2026-11-01", endDate: "2026-10-31", status: "planned", published: false, notes: "", source: "" };
    expect(sprintInput.safeParse(sprint).success).toBe(false);
    expect(sprintInput.safeParse({ ...sprint, endDate: "2026-11-31" }).success).toBe(false);
    expect(sprintInput.safeParse({ ...sprint, endDate: "2026-11-14" }).success).toBe(true);
  });
});
