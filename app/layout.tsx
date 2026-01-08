import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ConfirmModalProvider } from "@/components/providers/ConfirmModalProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lucy Inventory",
  description: "Inventory, sales, and expense tracking made simple.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <ConfirmModalProvider>
          <div className="min-h-screen">
          <div className="lg:hidden fixed top-0 left-0 right-0 h-12 border-b border-border bg-background px-4 flex items-center justify-between z-40">
            <a href="#sidebar" className="px-2 py-1 rounded border border-border text-muted-foreground">
              ☰
            </a>
            <div className="text-sm font-medium">Lucy Inventory</div>
          </div>
          <aside id="sidebar" className="hidden lg:block fixed top-0 left-0 h-screen w-64 border-r border-border p-4 bg-background z-50">
            <div className="lg:hidden mb-4">
              <a href="#" className="px-2 py-1 rounded border border-border text-muted-foreground">Close</a>
            </div>
            <div className="text-xl font-semibold mb-6">Lucy Inventory</div>
            <nav className="space-y-2">
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/dashboard">
                Dashboard
              </Link>
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/inventory">
                Inventory
              </Link>
              <Link className="block px-2 py-1 ml-4 text-sm text-muted-foreground hover:text-foreground" href="/inventory/daily-report">
                Daily Report
              </Link>
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/menu">
                Menu
              </Link>
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/sales">
                Sales
              </Link>
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/expenses">
                Expenses
              </Link>
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/reports">
                Reports
              </Link>
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/insights">
                Insights
              </Link>
              <Link className="block px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground" href="/settings">
                Settings
              </Link>
            </nav>
          </aside>
          <main className="lg:ml-64 ml-0 h-screen overflow-y-auto p-4 lg:p-6 pt-12 lg:pt-0">{children}</main>
          </div>
        </ConfirmModalProvider>
      </body>
    </html>
  );
}
