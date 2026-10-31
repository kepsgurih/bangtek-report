import { Pool } from "pg";
import { randomBytes, createHash } from "node:crypto";

const base = process.env.APP_URL || "http://localhost:3000";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
const marker = `integration-${randomBytes(6).toString("hex")}`;
const password = randomBytes(24).toString("base64url");
const userIds: string[] = [];
const emails: string[] = [];
const sprintIds: number[] = [];
const taskIds: number[] = [];
let checks = 0;
function check(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  checks++;
}
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  origin = base,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  const setCookies = response.headers.getSetCookie();
  return {
    status: response.status,
    data,
    text,
    setCookies,
    cookie: setCookies.map((value) => value.split(";")[0]).join("; "),
  };
}
async function signup(suffix: string) {
  const email = `${marker}-${suffix}@example.invalid`;
  emails.push(email);
  const result = await request("/api/auth/sign-up/email", "POST", {
    name: `Integration ${suffix}`,
    email,
    password,
  });
  check(
    result.status === 200 && result.data?.user?.id,
    "Registration must persist a user and session",
  );
  userIds.push(result.data.user.id);
  check(result.cookie, "Registration must set a session cookie");
  return { ...result, email, id: result.data.user.id as string };
}
try {
  check(
    (await request("/api/admin")).status === 401,
    "Anonymous admin reads must be rejected",
  );
  check(
    (await request("/api/admin", "POST", {}, "", "https://untrusted.example"))
      .status === 403,
    "Cross-origin mutation must be rejected",
  );
  const ownerCount = await pool.query(
    "select count(*)::int as count from bangtek_owner",
  );
  const first = await signup("a");
  check(
    first.setCookies.some(
      (value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value),
    ),
    "Session cookie requires HttpOnly and SameSite",
  );
  const rawToken = first.cookie.split("=")[1];
  const savedSession = await pool.query(
    "select token from bangtek_session where user_id=$1",
    [first.id],
  );
  check(
    savedSession.rows[0]?.token ===
      createHash("sha256").update(rawToken).digest("hex"),
    "Only a hash of the session token may be stored",
  );
  check(
    (
      await request(
        "/api/admin",
        "GET",
        undefined,
        "bangtek_session=" + "f".repeat(64),
      )
    ).status === 401,
    "Forged sessions must be rejected",
  );
  check(
    (
      await request(
        "/api/auth/sign-in/email",
        "POST",
        { email: first.email, password },
        "",
        "https://untrusted.example",
      )
    ).status === 403,
    "Login rejects cross-origin requests",
  );
  const expectedOwner = ownerCount.rows[0].count === 0;
  if (!expectedOwner)
    await pool.query(
      "update bangtek_admin_access set approved = true where user_id = $1",
      [first.id],
    );
  const initial = await request("/api/admin", "GET", undefined, first.cookie);
  check(initial.status === 200, "Approved account must read admin data");
  check(
    initial.data.access.isOwner === expectedOwner,
    "Only first signup can bootstrap owner access",
  );
  const second = await signup("b");
  check(
    (await request("/api/admin", "GET", undefined, second.cookie)).status ===
      403,
    "Later registrations must wait for approval",
  );
  if (expectedOwner) {
    check(
      (
        await request(
          "/api/admin",
          "POST",
          { resource: "access", data: { userId: second.id, approved: true } },
          first.cookie,
        )
      ).status === 200,
      "Owner must approve another account",
    );
    check(
      (await request("/api/admin", "GET", undefined, second.cookie)).status ===
        200,
      "Approved account must gain access",
    );
    check(
      (
        await request(
          "/api/admin",
          "POST",
          { resource: "access", data: { userId: first.id, approved: false } },
          second.cookie,
        )
      ).status === 403,
      "Regular admin cannot change access",
    );
    check(
      (
        await request(
          "/api/admin",
          "POST",
          { resource: "access", data: { userId: second.id, approved: false } },
          first.cookie,
        )
      ).status === 200,
      "Owner can revoke access",
    );
    check(
      (await request("/api/admin", "GET", undefined, second.cookie)).status ===
        403,
      "Revocation must apply to an existing session immediately",
    );
  }
  const number = 90000 + Math.floor(Math.random() * 9000);
  const sprint = {
    number,
    title: marker,
    startDate: "2026-11-01",
    endDate: "2026-11-14",
    status: "planned",
    published: false,
    notes: "Integration test",
    source: "",
  };
  check(
    (
      await request(
        "/api/admin",
        "POST",
        { resource: "sprint", data: sprint },
        first.cookie,
      )
    ).status === 200,
    "Create sprint",
  );
  let state = (await request("/api/admin", "GET", undefined, first.cookie))
    .data;
  let savedSprint = state.sprints.find((row: any) => row.number === number);
  sprintIds.push(savedSprint.id);
  const task = {
    title: marker + "-task",
    description: "Integration description",
    category: "Test",
    priority: "high",
    sprintId: null,
    status: "todo",
    blocker: "",
    steps: [
      { title: "First step", done: false },
      { title: "Second step", done: false },
    ],
  };
  check(
    (
      await request(
        "/api/admin",
        "POST",
        { resource: "task", data: task },
        first.cookie,
      )
    ).status === 200,
    "Create backlog task with steps",
  );
  state = (await request("/api/admin", "GET", undefined, first.cookie)).data;
  let savedTask = state.tasks.find((row: any) => row.title === task.title);
  taskIds.push(savedTask.id);
  check(
    (
      await request(
        "/api/admin",
        "POST",
        { resource: "task", data: { ...savedTask, status: "in_progress" } },
        first.cookie,
      )
    ).status === 400,
    "Backlog cannot be marked in progress",
  );
  check(
    (
      await request(
        "/api/admin",
        "POST",
        {
          resource: "task",
          data: {
            ...savedTask,
            sprintId: savedSprint.id,
            status: "in_progress",
            steps: [
              { title: "First step", done: true },
              { title: "Second step", done: false },
            ],
          },
        },
        first.cookie,
      )
    ).status === 200,
    "Assign backlog to sprint and persist partial progress",
  );
  check(
    (
      await request(
        "/api/admin",
        "POST",
        { resource: "task", data: savedTask },
        first.cookie,
      )
    ).status === 409,
    "Stale edits must be rejected",
  );
  check(
    (
      await request(
        "/api/admin",
        "DELETE",
        {
          resource: "sprint",
          id: savedSprint.id,
          version: savedSprint.version,
        },
        first.cookie,
      )
    ).status === 409,
    "Cannot delete sprint while it contains tasks",
  );
  check(
    !(await request(`/?sprint=${number}`)).text.includes(marker),
    "Draft sprint and assigned tasks must stay private",
  );
  check(
    (
      await request(
        "/api/admin",
        "POST",
        { resource: "sprint", data: { ...savedSprint, published: true } },
        first.cookie,
      )
    ).status === 200,
    "Publish sprint",
  );
  check(
    (await request(`/?sprint=${number}`)).text.includes(task.title),
    "Published report must contain saved task",
  );
  // Warm the public cache, then ensure an admin edit cannot leave stale public content.
  state = (await request("/api/admin", "GET", undefined, first.cookie)).data;
  savedTask = state.tasks.find((row: any) => row.id === savedTask.id);
  const updatedTitle = task.title + "-updated";
  check(
    (
      await request(
        "/api/admin",
        "POST",
        { resource: "task", data: { ...savedTask, title: updatedTitle } },
        first.cookie,
      )
    ).status === 200,
    "Update a published task",
  );
  check(
    (await request(`/?sprint=${number}`)).text.includes(updatedTitle),
    "Admin save must immediately invalidate the public cache",
  );
  state = (await request("/api/admin", "GET", undefined, first.cookie)).data;
  savedSprint = state.sprints.find((row: any) => row.id === savedSprint.id);
  check(
    (
      await request(
        "/api/admin",
        "POST",
        { resource: "sprint", data: { ...savedSprint, published: false } },
        first.cookie,
      )
    ).status === 200,
    "Unpublish a cached sprint",
  );
  check(
    !(await request(`/?sprint=${number}`)).text.includes(updatedTitle),
    "Unpublished task must disappear from cached public responses",
  );
  state = (await request("/api/admin", "GET", undefined, first.cookie)).data;
  savedTask = state.tasks.find((row: any) => row.id === savedTask.id);
  savedSprint = state.sprints.find((row: any) => row.id === savedSprint.id);
  check(
    (
      await request(
        "/api/admin",
        "DELETE",
        { resource: "task", id: savedTask.id, version: savedTask.version },
        first.cookie,
      )
    ).status === 200,
    "Delete task through the authenticated API",
  );
  check(
    (
      await request(
        "/api/admin",
        "DELETE",
        {
          resource: "sprint",
          id: savedSprint.id,
          version: savedSprint.version,
        },
        first.cookie,
      )
    ).status === 200,
    "Delete empty sprint through the authenticated API",
  );
  const wrong = await request("/api/auth/sign-in/email", "POST", {
    email: first.email,
    password: password + "wrong",
  });
  check(wrong.status === 401, "Incorrect password must be rejected");
  check(
    (await request("/api/auth/sign-out", "POST", {}, first.cookie)).status ===
      200,
    "Sign out must succeed",
  );
  check(
    (await request("/api/admin", "GET", undefined, first.cookie)).status ===
      401,
    "Signed-out session must be invalidated",
  );
  const login = await request("/api/auth/sign-in/email", "POST", {
    email: first.email,
    password,
  });
  check(
    login.status === 200 && login.cookie,
    "Existing account must log in again",
  );
  const limiterKey =
    "manual:login:" + createHash("sha256").update(first.email).digest("hex");
  await pool.query(
    "update bangtek_rate_limit set count=8, last_request=$1 where key=$2",
    [Date.now(), limiterKey],
  );
  check(
    (
      await request("/api/auth/sign-in/email", "POST", {
        email: first.email,
        password,
      })
    ).status === 429,
    "Rate limiting must reject excessive login attempts",
  );
  await pool.query(
    "update bangtek_session set expires_at=$1 where user_id=$2",
    [new Date(Date.now() - 1000), first.id],
  );
  check(
    (await request("/api/admin", "GET", undefined, login.cookie)).status ===
      401,
    "Expired sessions must be rejected",
  );
  console.log(
    `Integration passed: ${checks} checks (registration, sessions, access, CRUD, conflicts, publication).`,
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? `Integration failed: ${error.message}`
      : "Integration failed.",
  );
  process.exitCode = 1;
} finally {
  // Only remove IDs created by this run; existing users and report content remain untouched.
  for (const id of taskIds)
    await pool.query("delete from bangtek_task where id = $1", [id]);
  for (const id of sprintIds)
    await pool.query("delete from bangtek_sprint where id = $1", [id]);
  for (const email of emails) {
    const result = await pool.query(
      "select id from bangtek_user where email = $1",
      [email],
    );
    for (const row of result.rows) {
      await pool.query("delete from bangtek_owner where user_id = $1", [
        row.id,
      ]);
      await pool.query("delete from bangtek_user where id = $1", [row.id]);
    }
  }
  for (const email of emails) {
    const digest = createHash("sha256").update(email).digest("hex");
    await pool.query(
      "delete from bangtek_rate_limit where key = any($1::text[])",
      [[`manual:login:${digest}`, `manual:register:${digest}`]],
    );
  }
  await pool.end();
  console.log("Temporary integration records cleaned up.");
}
