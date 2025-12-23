function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatYMD(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseLocalYMD(s: string) {
  const [y, m, d] = s.split("-").map((v) => Number(v));
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function expenseRangeFromParams(start?: string, end?: string) {
  const startStr = start && start.length > 0 ? start : undefined;
  const endExclusiveStr =
    end && end.length > 0 ? formatYMD(addDays(parseLocalYMD(end), 1)) : undefined;
  return { startStr, endExclusiveStr };
}

export function salesRangeFromParams(start?: string, end?: string) {
  const startDate =
    start && start.length > 0
      ? (() => {
          const d = parseLocalYMD(start);
          return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
        })()
      : undefined;
  const endExclusiveDate =
    end && end.length > 0
      ? (() => {
          const d = parseLocalYMD(end);
          const next = addDays(d, 1);
          return new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate(), 0, 0, 0));
        })()
      : undefined;
  return { startDate, endExclusiveDate };
}

export function getExpensePresets() {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = addDays(t, -1);
  const dow = t.getDay();
  const monday = addDays(t, -((dow + 6) % 7));
  const nextMonday = addDays(monday, 7);
  const sunday = addDays(nextMonday, -1);
  const firstOfMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  const firstOfNextMonth = new Date(t.getFullYear(), t.getMonth() + 1, 1);
  const lastOfMonth = addDays(firstOfNextMonth, -1);
  return [
    { label: "Today", start: formatYMD(t), end: formatYMD(t) },
    { label: "Yesterday", start: formatYMD(y), end: formatYMD(y) },
    { label: "This Week", start: formatYMD(monday), end: formatYMD(sunday) },
    { label: "This Month", start: formatYMD(firstOfMonth), end: formatYMD(lastOfMonth) },
  ];
}

