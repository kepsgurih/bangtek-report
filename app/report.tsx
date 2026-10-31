"use client";
import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReportData, Task } from "@/lib/types";

const priorityLabels = { high: "Tinggi", medium: "Sedang", low: "Rendah" };
function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value));
}
function TaskDescription({ text, id }: { text: string; id: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div className="task-description">
      <p
        id={`description-${id}`}
        className={expanded ? "" : "description-preview"}
      >
        {text}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`description-${id}`}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
function TaskItem({
  task,
  first = false,
  backlog = false,
}: {
  task: Task;
  first?: boolean;
  backlog?: boolean;
}) {
  const done = task.steps.filter((step) => step.done).length;
  const current = task.steps.findIndex((step) => !step.done);
  return (
    <article
      className={`simple-task task-with-description ${backlog ? "backlog-task" : ""}`}
    >
      <div className="sprint-task-heading">
        <div className="simple-task-heading">
          <span className="task-id">TASK-{task.id}</span>
          <h2 className="simple-task-title">{task.title}</h2>
        </div>
        <div className="sprint-task-badges">
          {task.status === "in_progress" && (
            <span
              className="task-badge-progress"
              aria-label="Sedang dikerjakan"
            >
              <span>Dikerjakan</span>
            </span>
          )}
          {task.status === "done" && (
            <span className="task-badge-done" aria-label="Selesai">
              <span>Selesai</span>
            </span>
          )}
          <span
            aria-label={`Prioritas ${priorityLabels[task.priority]}`}
            className={`report-priority ${task.priority === "high" ? "priority-high" : ""}`}
          >
            {priorityLabels[task.priority]}
          </span>
        </div>
      </div>
      <TaskDescription text={task.description} id={String(task.id)} />
      <details className="task-stage-details" open={first}>
        <summary>
          <span>Tahapan</span>
          <span>
            {done}/{task.steps.length} selesai{" "}
            <span className="simple-task-toggle" aria-hidden="true">
              ⌄
            </span>
          </span>
        </summary>
        <div className="simple-task-detail">
          <ol className="report-steps" aria-label={`Tahapan TASK-${task.id}`}>
            {task.steps.map((step, index) => (
              <li
                key={index}
                className={
                  step.done
                    ? "step-done"
                    : index === current && task.status === "blocked"
                      ? "step-blocked"
                      : index === current && task.status === "in_progress"
                        ? "step-current"
                        : ""
                }
              >
                <span className="step-marker">
                  {step.done ? "✓" : index + 1}
                </span>
                <span>
                  <span className="step-title">{step.title}</span>
                  <small>
                    {step.done
                      ? "Selesai"
                      : index === current && task.status === "blocked"
                        ? "Terhambat"
                        : index === current && task.status === "in_progress"
                          ? "Sedang dikerjakan"
                          : "Belum dimulai"}
                  </small>
                </span>
              </li>
            ))}
          </ol>
          {task.status === "blocked" && task.blocker && (
            <p className="simple-task-note">{task.blocker}</p>
          )}
        </div>
      </details>
    </article>
  );
}
export default function Report({ data }: { data: ReportData }) {
  const params = useSearchParams();
  const selected =
    data.sprints.find((s) => String(s.number) === params.get("sprint")) ??
    data.sprints.find((s) => s.status === "active") ??
    data.sprints[0];
  const backlog = data.tasks.filter((t) => t.sprintId === null);
  const isBacklog = params.get("view") === "backlog";
  const tasks = data.tasks
    .filter((t) => t.sprintId === selected?.id)
    .sort(
      (a, b) =>
        Number(b.status === "in_progress") -
        Number(a.status === "in_progress"),
    );
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [notice, setNotice] = useState("");
  const visibleBacklog = backlog.filter(
    (item) =>
      (priority === "all" || item.priority === priority) &&
      `${item.title} ${item.description} ${item.category} TASK-${item.id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function navigateReport(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setNotice("");
    window.history.pushState(null, "", event.currentTarget.href);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Tautan laporan disalin.");
    } catch {
      setNotice("Salin tautan melalui address bar browser.");
    }
  }
  const querySprint = selected ? `sprint=${selected.number}` : "";
  return (
    <div className="report">
      <header className="report-header">
        <Link className="report-brand" href="/">
          bangtek<span>.</span>
        </Link>
        <button onClick={share} className="share-report">
          ↗ Bagikan
        </button>
      </header>
      <main className="report-main">
        <nav className="report-menu" aria-label="Menu laporan">
          <a
            onClick={navigateReport}
            href={`/?${querySprint}`}
            aria-current={!isBacklog ? "page" : undefined}
          >
            Laporan sprint
          </a>
          <a
            onClick={navigateReport}
            href={`/?view=backlog${querySprint ? `&${querySprint}` : ""}`}
            aria-current={isBacklog ? "page" : undefined}
          >
            Backlog <span>{backlog.length}</span>
          </a>
        </nav>
        {notice && (
          <div className="report-notice" role="status">
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Tutup pemberitahuan"
            >
              ×
            </button>
          </div>
        )}
        {isBacklog ? (
          <section className="backlog-page">
            <h1>Daftar backlog</h1>
            <div className="backlog-tools">
              <label>
                Cari pekerjaan
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nama atau nomor task"
                />
              </label>
              <label htmlFor="backlog-priority">
                Prioritas
                <select
                  id="backlog-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="all">Semua</option>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="backlog-result" role="status">
              {visibleBacklog.length} dari {backlog.length} pekerjaan
            </p>
            <div className="report-backlog">
              {visibleBacklog.map((task) => (
                <TaskItem key={task.id} task={task} backlog />
              ))}
              {!visibleBacklog.length && (
                <p className="backlog-empty">
                  {query || priority !== "all"
                    ? "Tidak ada pekerjaan yang cocok."
                    : "Belum ada pekerjaan di backlog."}
                </p>
              )}
            </div>
          </section>
        ) : selected ? (
          <div key={selected.id}>
            <section className="simple-sprint">
              <div className="simple-sprint-heading">
                <h1>Sprint {selected.number}</h1>
                <label className="simple-sprint-select">
                  <span className="sr-only">Pilih laporan sprint</span>
                  <select
                    value={selected.number}
                    onChange={(e) => {
                      setNotice("");
                      window.history.pushState(
                        null,
                        "",
                        `/?sprint=${e.target.value}`,
                      );
                    }}
                  >
                    {data.sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.number}>
                        Sprint {sprint.number}
                        {sprint.status === "active"
                          ? " · Aktif"
                          : sprint.status === "planned"
                            ? " · Rencana"
                            : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="simple-sprint-date">
                {selected.status === "completed"
                  ? "Berakhir"
                  : "Target selesai"}{" "}
                {formatDate(selected.endDate)}
              </p>
              <div
                className="sprint-facts"
                aria-label="Ringkasan pekerjaan sprint"
              >
                <div className="sprint-fact">
                  <span>Total task</span>
                  <strong>{tasks.length}</strong>
                  <small>di sprint ini</small>
                </div>
                <div className="sprint-fact">
                  <span>Dikerjakan</span>
                  <strong>
                    {tasks.filter((t) => t.status === "in_progress").length}
                  </strong>
                  <small>
                    {tasks.some((t) => t.status === "blocked")
                      ? `${tasks.filter((t) => t.status === "blocked").length} lainnya tertahan`
                      : "sedang berjalan"}
                  </small>
                </div>
                <div className="sprint-fact">
                  <span>Selesai</span>
                  <strong>
                    {tasks.filter((t) => t.status === "done").length}
                  </strong>
                  <small>dari {tasks.length} task</small>
                </div>
              </div>
            </section>
            <section className="simple-work" aria-label="Pekerjaan sprint">
              {tasks.map((task, index) => (
                <TaskItem key={task.id} task={task} first={index === 0} />
              ))}
              {!tasks.length && (
                <p className="backlog-empty">
                  Belum ada task dalam sprint ini.
                </p>
              )}
            </section>
            {(selected.notes || selected.source) && (
              <details className="simple-archive">
                <summary>
                  Catatan sprint <span aria-hidden="true">⌄</span>
                </summary>
                {selected.notes && (
                  <p className="preserve-lines">{selected.notes}</p>
                )}
                {selected.source && (
                  <p className="report-source">Sumber: {selected.source}</p>
                )}
              </details>
            )}
          </div>
        ) : (
          <section className="public-empty">
            <h1>Belum ada laporan sprint</h1>
            <p>Laporan akan muncul setelah sprint diterbitkan.</p>
          </section>
        )}
        <footer className="report-footer">
          <span>
            {!isBacklog && selected
              ? `Diperbarui ${formatDate(selected.updatedAt)}`
              : "Bangtek Progress"}
          </span>
        </footer>
      </main>
    </div>
  );
}
