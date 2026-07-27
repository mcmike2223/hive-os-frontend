import PusherModule from "pusher-js";

const token = process.env.HR_TEST_TOKEN;
const apiRoot = process.env.HR_TEST_API_ROOT ?? "http://hive-backend:8000/api/v1";
const reverbHost = process.env.HR_TEST_REVERB_HOST ?? "hive-reverb";
const reverbPort = Number(process.env.HR_TEST_REVERB_PORT ?? 9000);
const reverbKey = process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? "uq8zbsjhgcajsmdiwhc8";

if (!token) {
  throw new Error("HR_TEST_TOKEN is required.");
}

const Pusher = PusherModule.Pusher ?? PusherModule;
const headers = {
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
};
let createdPayslipId = null;
let finished = false;

async function api(path, options = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${body}`);
  }

  return response.status === 204 ? null : response.json();
}

async function removeFixture(id = createdPayslipId) {
  if (!id) return;
  await api(`/hr/payroll/payslips/${id}`, { method: "DELETE" });
  createdPayslipId = null;
}

const pusher = new Pusher(reverbKey, {
  wsHost: reverbHost,
  wsPort: reverbPort,
  forceTLS: false,
  enabledTransports: ["ws"],
  disableStats: true,
  cluster: "mt1",
  authorizer: (channel) => ({
    authorize: async (socketId, callback) => {
      try {
        const response = await fetch(`${apiRoot}/broadcasting/auth`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            socket_id: socketId,
            channel_name: channel.name,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          callback(new Error(`Channel authorization returned ${response.status}.`), null);
          return;
        }
        callback(null, payload);
      } catch (error) {
        callback(error, null);
      }
    },
  }),
});

const channel = pusher.subscribe("private-hr");
const timeout = setTimeout(async () => {
  if (finished) return;
  finished = true;
  await removeFixture().catch(() => undefined);
  pusher.disconnect();
  throw new Error("Timed out waiting for the hr.updated Reverb event.");
}, 20_000);

channel.bind("pusher:subscription_error", (error) => {
  throw new Error(`Private HR subscription failed: ${JSON.stringify(error)}`);
});

channel.bind("pusher:subscription_succeeded", async () => {
  const dashboard = await api("/hr/dashboard?months=3");
  const employees = await api("/hr/employees?per_page=1");
  const employeeId = employees?.data?.[0]?.id;
  if (!employeeId) throw new Error("No employee is available for the realtime fixture.");

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, now.getUTCMonth() + 1, 0))
    .getUTCDate()
    .toString()
    .padStart(2, "0");

  const response = await api("/hr/payroll/payslips", {
    method: "POST",
    body: JSON.stringify({
      employee_id: employeeId,
      pay_period_start: `${year}-${month}-01`,
      pay_period_end: `${year}-${month}-${lastDay}`,
      transport_allowance: 137,
      notes: "Temporary realtime dashboard verification; automatically removed.",
    }),
  });
  createdPayslipId = response?.data?.id ?? createdPayslipId;

  if (dashboard?.data?.generated_at === undefined) {
    throw new Error("The authenticated dashboard response is missing generated_at.");
  }
});

channel.bind("hr.updated", async (event) => {
  if (finished || event?.resource !== "payslip" || event?.action !== "created") return;

  finished = true;
  clearTimeout(timeout);
  const eventRecordId = Number(event.record_id);
  await removeFixture(eventRecordId);
  pusher.disconnect();
  process.stdout.write(JSON.stringify({
    subscribed: true,
    authenticatedDashboard: true,
    event: "hr.updated",
    resource: event.resource,
    action: event.action,
    recordIdMatched: Number.isInteger(eventRecordId) && eventRecordId > 0,
    fixtureRemoved: true,
  }));
});
