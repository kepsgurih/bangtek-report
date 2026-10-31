import { z } from "zod";
const date = z.iso.date();
export const sprintInput = z.object({
  id: z.number().int().positive().optional(), version: z.number().int().positive().optional(),
  number: z.number().int().min(1).max(99999), title: z.string().trim().min(3).max(180),
  startDate: date, endDate: date, status: z.enum(["planned", "active", "completed"]), published: z.boolean(),
  notes: z.string().trim().max(10000), source: z.string().trim().max(1000),
}).refine(value => value.endDate >= value.startDate, { message: "Tanggal akhir tidak boleh sebelum tanggal mulai.", path: ["endDate"] });
export const taskInput = z.object({
  id: z.number().int().positive().optional(), version: z.number().int().positive().optional(),
  sprintId: z.number().int().positive().nullable(), title: z.string().trim().min(3).max(180), description: z.string().trim().max(10000), category: z.string().trim().max(80),
  priority: z.enum(["high", "medium", "low"]), status: z.enum(["todo", "in_progress", "blocked", "done"]), blocker: z.string().trim().max(2000),
  steps: z.array(z.object({ title: z.string().trim().min(1).max(180), done: z.boolean() })).min(1).max(30),
}).superRefine((value, context) => {
  const error = (message: string) => context.addIssue({ code: "custom", message });
  const allDone = value.steps.every(step => step.done);
  if (value.sprintId === null && (value.status !== "todo" || value.steps.some(step => step.done))) error("Task backlog harus berstatus belum dimulai dan seluruh tahap belum selesai.");
  if (value.status === "done" && !allDone) error("Selesaikan semua tahap sebelum menandai task selesai.");
  if (value.status !== "done" && allDone) error("Semua tahap sudah selesai. Ubah status task menjadi selesai.");
  if (value.status === "todo" && value.steps.some(step => step.done)) error("Task belum dimulai tidak boleh memiliki tahap selesai.");
  if (value.status === "blocked" && !value.blocker) error("Jelaskan kendala task yang terhambat.");
});
export const mutationInput = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("sprint"), data: sprintInput }),
  z.object({ resource: z.literal("task"), data: taskInput }),
  z.object({ resource: z.literal("access"), data: z.object({ userId: z.string().min(1), approved: z.boolean() }) }),
]);
export const deletionInput = z.object({ resource: z.enum(["sprint", "task"]), id: z.number().int().positive(), version: z.number().int().positive() });
