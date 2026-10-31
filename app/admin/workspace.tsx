"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authRequest } from "@/lib/auth-client";
import type { Access, ReportData, Sprint, Task } from "@/lib/types";

type Workspace = ReportData & {
  users: {
    id: string;
    name: string;
    email: string;
    approved: boolean | null;
  }[];
};
type SprintDraft = Omit<Sprint, "id" | "updatedAt" | "version"> & {
  id?: number;
  version?: number;
};
type TaskDraft = Omit<Task, "id" | "updatedAt" | "version"> & {
  id?: number;
  version?: number;
};
const statuses: Record<Task["status"], string> = {
  todo: "Belum dimulai",
  in_progress: "Dikerjakan",
  blocked: "Terhambat",
  done: "Selesai",
};
const priorities: Record<Task["priority"], string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};
const defaultSteps = [
  "Sepakati kebutuhan",
  "Rancang solusi",
  "Kerjakan fitur",
  "Pengujian",
  "Siap digunakan",
].map((title) => ({ title, done: false }));

export function Admin({ access }: { access: Access }) {
  const [tab, setTab] = useState("Ringkasan");
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [editor, setEditor] = useState<"sprint" | "task" | null>(null);
  const [sprint, setSprint] = useState<SprintDraft | null>(null);
  const [task, setTask] = useState<TaskDraft | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Workspace gagal dimuat.",
      );
    }
  }, []);
  useEffect(() => {
    if (access.approved) void refresh();
  }, [access.approved, refresh]);
  useEffect(() => {
    if (editor && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [editor]);
  async function logout() {
    try {
      await authRequest("sign-out");
      window.location.assign("/login");
    } catch {
      setError("Keluar belum berhasil. Coba lagi.");
    }
  }
  async function mutate(resource: string, values: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          method === "DELETE"
            ? { resource, ...(values as object) }
            : { resource, data: values },
        ),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setEditor(null);
      setNotice(method === "DELETE" ? "Data dihapus." : "Perubahan tersimpan.");
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Perubahan gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  function editSprint(value?: Sprint) {
    setError("");
    setSprint(
      value
        ? { ...value }
        : {
            number:
              Math.max(0, ...(data?.sprints.map((s) => s.number) ?? [])) + 1,
            title: "",
            startDate: "",
            endDate: "",
            status: "planned",
            published: false,
            notes: "",
            source: "",
          },
    );
    setEditor("sprint");
  }
  function editTask(value?: Task) {
    setError("");
    setTask(
      value
        ? { ...value, steps: value.steps.map((step) => ({ ...step })) }
        : {
            sprintId:
              tab === "Backlog"
                ? null
                : (data?.sprints.find((s) => s.status === "active")?.id ??
                  null),
            title: "",
            description: "",
            category: "",
            priority: "medium",
            status: "todo",
            blocker: "",
            steps: defaultSteps.map((step) => ({ ...step })),
          },
    );
    setEditor("task");
  }
  function changeStatus(status: Task["status"]) {
    setTask(
      (value) =>
        value && {
          ...value,
          status,
          steps: value.steps.map((step) => ({
            ...step,
            done:
              status === "done" ? true : status === "todo" ? false : step.done,
          })),
        },
    );
  }
  function updateStep(index: number, patch: Partial<Task["steps"][number]>) {
    setTask((value) => {
      if (!value) return value;
      const steps = value.steps.map((step, i) =>
        i === index ? { ...step, ...patch } : step,
      );
      const allDone = steps.every((step) => step.done);
      const anyDone = steps.some((step) => step.done);
      return {
        ...value,
        steps,
        status: allDone
          ? "done"
          : value.status === "done" || (value.status === "todo" && anyDone)
            ? "in_progress"
            : value.status,
      };
    });
  }
  if (!access.approved)
    return (
      <main className="auth-page">
        <Link href="/" className="auth-brand">
          bangtek.
        </Link>
        <section className="auth-card">
          <h1>Menunggu persetujuan</h1>
          <p>
            Akun {access.user.email} sudah terdaftar. Admin utama perlu
            menyetujui akses sebelum kamu bisa mengelola laporan.
          </p>
          <button
            className="admin-primary"
            onClick={() => window.location.reload()}
          >
            Periksa akses
          </button>
          <button className="admin-secondary" onClick={logout}>
            Keluar
          </button>
        </section>
      </main>
    );
  const active = data?.sprints.find((s) => s.status === "active");
  const rows = (data?.tasks ?? []).filter(
    (t) =>
      (tab !== "Backlog" || t.sprintId === null) &&
      (tab !== "Tasks" ||
        sprintFilter === "all" ||
        String(t.sprintId) === sprintFilter) &&
      `${t.title} TASK-${t.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="auth-brand">
          bangtek.
        </Link>
        <span className="admin-workspace-label">PROJECT WORKSPACE</span>
        <nav aria-label="Menu admin">
          {[
            "Ringkasan",
            "Sprint",
            "Tasks",
            "Backlog",
            ...(access.isOwner ? ["Akses akun"] : []),
          ].map((label, index) => (
            <button
              key={label}
              className={tab === label ? "selected" : ""}
              onClick={() => {
                setTab(label);
                setQuery("");
              }}
            >
              <span aria-hidden="true">
                {["◫", "◷", "☷", "▤", "♙"][index]}
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-mobile-session">
          <span>{access.user.name}</span>
          <button onClick={logout}>Keluar</button>
        </div>
        <div className="admin-sidebar-bottom">
          <Link href="/" target="_blank">
            Buka laporan publik ↗
          </Link>
          <strong>{access.user.name}</strong>
          <small>{access.isOwner ? "Admin utama" : "Admin"}</small>
          <button onClick={logout}>Keluar</button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <span className="admin-eyebrow">BANGTEK / ADMIN</span>
            <h1>{tab}</h1>
            <p>
              {tab === "Backlog"
                ? "Rencanakan pekerjaan sebelum masuk sprint."
                : tab === "Sprint"
                  ? "Atur periode, status, dan publikasi laporan."
                  : tab === "Tasks"
                    ? "Kelola prioritas dan progres setiap pekerjaan."
                    : tab === "Akses akun"
                      ? "Setujui atau cabut akses pengelola laporan."
                      : "Pantau pekerjaan dan siapkan update berikutnya."}
            </p>
          </div>
          {tab !== "Akses akun" && (
            <button
              className="admin-primary"
              onClick={() => (tab === "Sprint" ? editSprint() : editTask())}
            >
              + {tab === "Sprint" ? "Sprint baru" : "Task baru"}
            </button>
          )}
        </header>
        {error && !editor && (
          <div className="admin-error" role="alert">
            {error}
            <button onClick={refresh}>Muat ulang</button>
          </div>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            {notice}
          </div>
        )}
        {!data ? (
          <div className="admin-card">
            {error ? "Data belum tersedia." : "Memuat data…"}
          </div>
        ) : (
          <>
            {tab === "Ringkasan" && (
              <>
                <div className="admin-stats">
                  {[
                    ["Sprint aktif", active ? String(active.number) : "—"],
                    [
                      "Task dalam sprint",
                      String(
                        data.tasks.filter((t) => t.sprintId === active?.id)
                          .length,
                      ),
                    ],
                    [
                      "Task selesai",
                      String(
                        data.tasks.filter(
                          (t) =>
                            t.sprintId === active?.id && t.status === "done",
                        ).length,
                      ),
                    ],
                    [
                      "Backlog",
                      String(
                        data.tasks.filter((t) => t.sprintId === null).length,
                      ),
                    ],
                  ].map(([title, value]) => (
                    <section className="admin-card" key={title}>
                      <small>{title}</small>
                      <strong>{value}</strong>
                    </section>
                  ))}
                </div>
                <section className="admin-card admin-current">
                  <div>
                    <span className="admin-eyebrow">SPRINT SAAT INI</span>
                    <h2>
                      {active
                        ? `Sprint ${active.number} — ${active.title}`
                        : "Belum ada sprint aktif"}
                    </h2>
                    <p>
                      {active
                        ? `${active.startDate} sampai ${active.endDate} · ${active.published ? "Tayang di laporan publik" : "Masih draft"}`
                        : "Buat sprint, tambahkan task, lalu terbitkan laporannya."}
                    </p>
                  </div>
                  <button
                    className="admin-secondary"
                    onClick={() => (active ? editSprint(active) : editSprint())}
                  >
                    {active ? "Kelola sprint" : "Buat sprint"}
                  </button>
                </section>
                <div className="admin-section-title">
                  <h2>Pekerjaan terbaru</h2>
                  <button onClick={() => setTab("Tasks")}>Lihat semua →</button>
                </div>
              </>
            )}
            {tab === "Sprint" ? (
              <section className="admin-card admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Sprint</th>
                      <th>Periode</th>
                      <th>Status</th>
                      <th>Laporan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sprints.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>Sprint {row.number}</strong>
                          <small>{row.title}</small>
                        </td>
                        <td>
                          {row.startDate}
                          <br />
                          {row.endDate}
                        </td>
                        <td>
                          <span className={`admin-badge ${row.status}`}>
                            {row.status === "active"
                              ? "Aktif"
                              : row.status === "completed"
                                ? "Selesai"
                                : "Direncanakan"}
                          </span>
                        </td>
                        <td>{row.published ? "Terbit" : "Draft"}</td>
                        <td>
                          <button onClick={() => editSprint(row)}>Edit</button>
                          <button
                            disabled={busy}
                            className="admin-danger"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Hapus Sprint ${row.number}? Sprint hanya bisa dihapus setelah seluruh task dipindahkan.`,
                                )
                              )
                                void mutate(
                                  "sprint",
                                  { id: row.id, version: row.version },
                                  "DELETE",
                                );
                            }}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.sprints.length && (
                  <p className="admin-empty">
                    Belum ada sprint. Buat sprint pertama.
                  </p>
                )}
              </section>
            ) : tab === "Akses akun" ? (
              <section className="admin-card admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Email</th>
                      <th>Akses</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>
                          {row.id === access.user.id
                            ? "Admin utama"
                            : row.approved
                              ? "Admin"
                              : "Menunggu"}
                        </td>
                        <td>
                          {row.id !== access.user.id && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                mutate("access", {
                                  userId: row.id,
                                  approved: !row.approved,
                                })
                              }
                            >
                              {row.approved ? "Cabut akses" : "Setujui"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <section className="admin-card admin-table-wrap">
                <div className="admin-table-tools">
                  <input
                    type="search"
                    aria-label="Cari task"
                    placeholder="Cari nama atau nomor task…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {tab === "Tasks" && (
                    <select
                      aria-label="Filter sprint"
                      value={sprintFilter}
                      onChange={(e) => setSprintFilter(e.target.value)}
                    >
                      <option value="all">Semua sprint & backlog</option>
                      <option value="null">Backlog</option>
                      {data.sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          Sprint {s.number}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Sprint</th>
                      <th>Prioritas</th>
                      <th>Progres</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tab === "Ringkasan"
                      ? rows.slice(-6).reverse()
                      : rows
                    ).map((row) => (
                      <tr key={row.id}>
                        <td>
                          <small>TASK-{row.id}</small>
                          <strong>{row.title}</strong>
                        </td>
                        <td>
                          {row.sprintId
                            ? `Sprint ${data.sprints.find((s) => s.id === row.sprintId)?.number ?? "—"}`
                            : "Backlog"}
                        </td>
                        <td>
                          <span className={`admin-badge ${row.priority}`}>
                            {priorities[row.priority]}
                          </span>
                        </td>
                        <td>
                          {row.steps.filter((step) => step.done).length}/
                          {row.steps.length}
                        </td>
                        <td>
                          <span className={`admin-badge ${row.status}`}>
                            {statuses[row.status]}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => editTask(row)}>Edit</button>
                          <button
                            className="admin-danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Hapus TASK-${row.id}? Task beserta tahapannya akan dihapus.`,
                                )
                              )
                                void mutate(
                                  "task",
                                  { id: row.id, version: row.version },
                                  "DELETE",
                                );
                            }}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <p className="admin-empty">
                    {query
                      ? "Tidak ada task yang cocok."
                      : "Belum ada task. Tambahkan pekerjaan pertama."}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>
      {editor && (
        <dialog
          ref={dialog}
          className="admin-dialog"
          aria-labelledby="editor-title"
          onCancel={(event) => {
            if (busy) event.preventDefault();
            else setEditor(null);
          }}
        >
          <div className="admin-dialog-heading">
            <h2 id="editor-title">
              {editor === "sprint"
                ? sprint?.id
                  ? "Edit sprint"
                  : "Sprint baru"
                : task?.id
                  ? `Edit TASK-${task.id}`
                  : "Task baru"}
            </h2>
            <button
              disabled={busy}
              onClick={() => setEditor(null)}
              aria-label="Tutup editor"
            >
              ×
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(editor, editor === "sprint" ? sprint : task);
            }}
          >
            {editor === "sprint" && sprint && (
              <>
                <div className="admin-form-grid">
                  <label>
                    Nomor sprint
                    <input
                      type="number"
                      min="1"
                      max="99999"
                      required
                      value={sprint.number}
                      onChange={(e) =>
                        setSprint({ ...sprint, number: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={sprint.status}
                      onChange={(e) =>
                        setSprint({
                          ...sprint,
                          status: e.target.value as Sprint["status"],
                        })
                      }
                    >
                      <option value="planned">Direncanakan</option>
                      <option value="active">Aktif</option>
                      <option value="completed">Selesai</option>
                    </select>
                  </label>
                </div>
                <label>
                  Fokus sprint
                  <input
                    required
                    minLength={3}
                    maxLength={180}
                    value={sprint.title}
                    onChange={(e) =>
                      setSprint({ ...sprint, title: e.target.value })
                    }
                  />
                </label>
                <div className="admin-form-grid">
                  <label>
                    Tanggal mulai
                    <input
                      type="date"
                      required
                      value={sprint.startDate}
                      onChange={(e) =>
                        setSprint({ ...sprint, startDate: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Tanggal akhir
                    <input
                      type="date"
                      required
                      min={sprint.startDate}
                      value={sprint.endDate}
                      onChange={(e) =>
                        setSprint({ ...sprint, endDate: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Catatan hasil sprint
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={sprint.notes}
                    onChange={(e) =>
                      setSprint({ ...sprint, notes: e.target.value })
                    }
                  />
                </label>
                <label>
                  Sumber laporan (opsional)
                  <input
                    placeholder="Misalnya: client v1.18.0 · commit…"
                    maxLength={1000}
                    value={sprint.source}
                    onChange={(e) =>
                      setSprint({ ...sprint, source: e.target.value })
                    }
                  />
                </label>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={sprint.published}
                    onChange={(e) =>
                      setSprint({ ...sprint, published: e.target.checked })
                    }
                  />
                  Terbitkan di laporan publik
                </label>
              </>
            )}
            {editor === "task" && task && (
              <>
                <label>
                  Judul task
                  <input
                    required
                    minLength={3}
                    maxLength={180}
                    value={task.title}
                    onChange={(e) =>
                      setTask({ ...task, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Deskripsi
                  <textarea
                    rows={5}
                    maxLength={10000}
                    placeholder="Tulis deskripsi task… (Enter untuk baris baru)"
                    value={task.description}
                    onChange={(e) =>
                      setTask({ ...task, description: e.target.value })
                    }
                  />
                </label>
                <div className="admin-form-grid">
                  <label>
                    Sprint
                    <select
                      value={task.sprintId ?? ""}
                      onChange={(e) => {
                        const sprintId = e.target.value
                          ? Number(e.target.value)
                          : null;
                        setTask({
                          ...task,
                          sprintId,
                          ...(sprintId === null
                            ? {
                                status: "todo",
                                steps: task.steps.map((step) => ({
                                  ...step,
                                  done: false,
                                })),
                              }
                            : {}),
                        });
                      }}
                    >
                      <option value="">Backlog (belum masuk sprint)</option>
                      {data?.sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          Sprint {s.number} · {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prioritas
                    <select
                      value={task.priority}
                      onChange={(e) =>
                        setTask({
                          ...task,
                          priority: e.target.value as Task["priority"],
                        })
                      }
                    >
                      {Object.entries(priorities).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="admin-form-grid">
                  <label>
                    Status
                    <select
                      value={task.status}
                      disabled={task.sprintId === null}
                      onChange={(e) =>
                        changeStatus(e.target.value as Task["status"])
                      }
                    >
                      {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Kategori
                    <input
                      maxLength={80}
                      value={task.category}
                      onChange={(e) =>
                        setTask({ ...task, category: e.target.value })
                      }
                    />
                  </label>
                </div>
                {task.status === "blocked" && (
                  <label>
                    Kendala
                    <textarea
                      required
                      rows={2}
                      maxLength={2000}
                      value={task.blocker}
                      onChange={(e) =>
                        setTask({ ...task, blocker: e.target.value })
                      }
                    />
                  </label>
                )}
                <div className="admin-steps-heading">
                  <h3>Tahapan pekerjaan</h3>
                  <span>
                    {task.steps.filter((step) => step.done).length}/
                    {task.steps.length} selesai
                  </span>
                </div>
                <div className="admin-edit-steps">
                  {task.steps.map((step, index) => (
                    <div key={index}>
                      <input
                        type="checkbox"
                        aria-label={`Tahap ${index + 1} selesai`}
                        checked={step.done}
                        disabled={task.sprintId === null}
                        onChange={(e) =>
                          updateStep(index, { done: e.target.checked })
                        }
                      />
                      <input
                        aria-label={`Nama tahap ${index + 1}`}
                        required
                        maxLength={180}
                        value={step.title}
                        onChange={(e) =>
                          updateStep(index, { title: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Naikkan tahap ${index + 1}`}
                        disabled={index === 0}
                        onClick={() => {
                          const steps = [...task.steps];
                          [steps[index - 1], steps[index]] = [
                            steps[index],
                            steps[index - 1],
                          ];
                          setTask({ ...task, steps });
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Turunkan tahap ${index + 1}`}
                        disabled={index === task.steps.length - 1}
                        onClick={() => {
                          const steps = [...task.steps];
                          [steps[index + 1], steps[index]] = [
                            steps[index],
                            steps[index + 1],
                          ];
                          setTask({ ...task, steps });
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Hapus tahap ${index + 1}`}
                        disabled={task.steps.length <= 1}
                        onClick={() => {
                          const steps = task.steps.filter(
                            (_, i) => i !== index,
                          );
                          setTask({
                            ...task,
                            steps,
                            status: steps.every((s) => s.done)
                              ? "done"
                              : task.status,
                          });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="admin-add-step"
                  disabled={task.steps.length >= 30}
                  onClick={() =>
                    setTask({
                      ...task,
                      status:
                        task.status === "done" ? "in_progress" : task.status,
                      steps: [...task.steps, { title: "", done: false }],
                    })
                  }
                >
                  + Tambah tahap
                </button>
              </>
            )}
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-form-footer">
              <button
                type="button"
                className="admin-secondary"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Batal
              </button>
              <button className="admin-primary" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan perubahan"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
