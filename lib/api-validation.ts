import { z } from "zod";

const step = z.object({ title: z.string().trim().min(1).max(180), done: z.boolean() });
const taskReference = z.union([
  z.number().int().positive(),
  z.string().regex(/^TASK-\d+$/i).transform((value) => Number(value.slice(5))),
]);
const sprintReference = z.union([
  z.number().int().positive(),
  z.literal("active"),
  z.literal("backlog"),
]);

export const apiRequestInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("tasks.list"),
    sprint: sprintReference.optional(),
    status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    search: z.string().trim().max(180).optional(),
  }),
  z.object({ action: z.literal("tasks.get"), id: taskReference }),
  z.object({
    action: z.literal("tasks.create"),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().max(10000).default(""),
    category: z.string().trim().max(80).default(""),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
    sprint: sprintReference.default("backlog"),
    steps: z.array(step).min(1).max(30).default([
      { title: "Sepakati kebutuhan", done: false },
      { title: "Rancang solusi", done: false },
      { title: "Kerjakan fitur", done: false },
      { title: "Pengujian", done: false },
      { title: "Siap digunakan", done: false },
    ]),
  }),
  z.object({
    action: z.literal("tasks.update"),
    id: taskReference,
    expectedVersion: z.number().int().positive().optional(),
    title: z.string().trim().min(3).max(180).optional(),
    description: z.string().trim().max(10000).optional(),
    category: z.string().trim().max(80).optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    blocker: z.string().trim().max(2000).optional(),
    sprint: sprintReference.optional(),
    steps: z.array(step).min(1).max(30).optional(),
  }),
  z.object({ action: z.literal("tasks.delete"), id: taskReference }),
  z.object({
    action: z.literal("sprints.create"),
    number: z.number().int().min(1).max(99999).optional(),
    title: z.string().trim().min(3).max(180),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    status: z.enum(["planned", "active", "completed"]).default("planned"),
    published: z.boolean().default(false),
    notes: z.string().trim().max(10000).default(""),
    source: z.string().trim().max(1000).default(""),
  }),
  z.object({
    action: z.literal("sprints.update"),
    number: z.number().int().min(1).max(99999),
    expectedVersion: z.number().int().positive().optional(),
    title: z.string().trim().min(3).max(180).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    status: z.enum(["planned", "active", "completed"]).optional(),
    published: z.boolean().optional(),
    notes: z.string().trim().max(10000).optional(),
    source: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("sprints.delete"), number: z.number().int().min(1).max(99999) }),
]);
