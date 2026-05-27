import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Language Coach — Admin" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <nav className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex gap-6 items-center">
            <span className="font-semibold">Language Coach · Admin</span>
            <Link href="/">Dashboard</Link>
            <Link href="/users">Users</Link>
            <Link href="/services">Services</Link>
            <Link href="/settings" className="ml-auto">
              Settings
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
