export function formatDateTime(date: Date | string | number) {
  const d = new Date(date);
  return d.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
