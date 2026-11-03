import { describe, expect, test } from "bun:test";
import { apiRequestInput } from "../lib/api-validation";
import { hashApiToken, safeTokenMatch } from "../lib/api-token";

describe("automation API input", () => {
  test("accepts task and sprint mutations", () => {
    expect(apiRequestInput.safeParse({ action: "tasks.list", sprint: "active" }).success).toBe(true);
    expect(apiRequestInput.safeParse({ action: "tasks.create", title: "Task baru" }).success).toBe(true);
    expect(apiRequestInput.safeParse({ action: "tasks.update", id: "TASK-12", status: "done" }).success).toBe(true);
    expect(apiRequestInput.safeParse({ action: "sprints.update", number: 19, published: true }).success).toBe(true);
  });

  test("rejects malformed references", () => {
    expect(apiRequestInput.safeParse({ action: "tasks.get", id: "task" }).success).toBe(false);
    expect(apiRequestInput.safeParse({ action: "tasks.update", id: 12, priority: "urgent" }).success).toBe(false);
  });

  test("compares token hashes safely", () => {
    const hash = hashApiToken("secret");
    expect(safeTokenMatch(hash, hash)).toBe(true);
    expect(safeTokenMatch(hash, hashApiToken("other"))).toBe(false);
  });
});
