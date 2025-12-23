import Link from "next/link";

export default function Page() {
  const items = [
    {
      title: "Payment Methods",
      description:
        "Manage how customers pay and track payment channels.",
      href: "/settings/payment-methods",
    },
    {
      title: "Suppliers",
      description: "Manage where you purchase inventory from",
      href: "/settings/suppliers",
    },
    {
      title: "Expense Categories",
      description:
        "Manage categories used when recording expenses.",
      href: "/settings/expense-categories",
    },
    {
      title: "Alert Thresholds",
      description: "Control when business alerts are triggered.",
      href: "/settings/alert-thresholds",
    },
    {
      title: "Audit Logs",
      description:
        "View a history of changes made across the system.",
      href: "/settings/audit-logs",
    },
    {
      title: "Reset System",
      description:
        "Permanently clear records to start with a clean system.",
      href: "/settings/reset-system",
    },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <div className="text-sm text-muted-foreground">Configure payment methods, categories, alerts, and view logs.</div>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="block bg-card text-card-foreground border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="text-lg font-medium">{it.title}</div>
            <div className="text-muted-foreground">{it.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
