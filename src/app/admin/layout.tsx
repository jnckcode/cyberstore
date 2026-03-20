import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const links = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/stocks", label: "Stocks" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/webhooks", label: "Webhooks" },
  { href: "/admin/audits", label: "Audits" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2 rounded-xl border border-border bg-background/60 p-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
