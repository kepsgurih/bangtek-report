export type Step = { title: string; done: boolean };
export type Sprint = { id: number; number: number; title: string; startDate: string; endDate: string; status: "planned" | "active" | "completed"; published: boolean; notes: string; source: string; version: number; updatedAt: string };
export type Task = { id: number; sprintId: number | null; title: string; description: string; category: string; priority: "high" | "medium" | "low"; status: "todo" | "in_progress" | "blocked" | "done"; blocker: string; steps: Step[]; version: number; updatedAt: string };
export type ReportData = { sprints: Sprint[]; tasks: Task[] };
export type Access = { user: { id: string; name: string; email: string }; approved: boolean; isOwner: boolean };
