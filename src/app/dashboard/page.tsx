import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  status: z.enum(["PENDING", "PAID", "EXPIRED"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional()
});

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { status?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsedSearch = searchSchema.safeParse(searchParams ?? {});
  const filters = parsedSearch.success ? parsedSearch.data : {};

  const fromDate = filters.from ? new Date(`${filters.from}T00:00:00`) : undefined;
  const toDate = filters.to ? new Date(`${filters.to}T23:59:59`) : undefined;

  const whereFilter = {
    user_id: Number(session.user.id),
    status: filters.status,
    created_at: fromDate || toDate ? { gte: fromDate, lte: toDate } : undefined
  };

  const [transactions, totalTransactions, paidTransactions, pendingTransactions, totalSpend] = await Promise.all([
    prisma.transaction.findMany({
      where: whereFilter,
      include: {
        product: true,
        stock: true
      },
      orderBy: {
        created_at: "desc"
      }
    }),
    prisma.transaction.count({
      where: whereFilter
    }),
    prisma.transaction.count({
      where: {
        ...whereFilter,
        status: "PAID"
      }
    }),
    prisma.transaction.count({
      where: {
        ...whereFilter,
        status: "PENDING"
      }
    }),
    prisma.transaction.aggregate({
      where: {
        ...whereFilter,
        status: "PAID"
      },
      _sum: {
        total_price: true
      }
    })
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard User</h1>

      <form className="grid gap-2 rounded-xl border border-border bg-background/60 p-3 md:grid-cols-4" method="GET">
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm"
        >
          <option value="">Semua status</option>
          <option value="PENDING">PENDING</option>
          <option value="PAID">PAID</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
        <input
          type="date"
          name="from"
          defaultValue={filters.from ?? ""}
          className="h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={filters.to ?? ""}
          className="h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm"
        />
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">
          Terapkan Filter
        </button>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Transaksi</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{totalTransactions}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{paidTransactions}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{pendingTransactions}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Spend</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">Rp {(totalSpend._sum.total_price ?? 0).toLocaleString("id-ID")}</CardContent>
        </Card>
      </section>

      <div className="grid gap-4">
        {transactions.map((transaction) => (
          <Card key={transaction.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{transaction.product.title}</span>
                <Badge variant={transaction.status === "PAID" ? "default" : "outline"}>{transaction.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Total Bayar: Rp {transaction.total_price.toLocaleString("id-ID")}</p>
              <p>Dibuat: {new Date(transaction.created_at).toLocaleString("id-ID")}</p>
              <Link href={`/dashboard/transactions/${transaction.id}`} className="text-primary hover:underline">
                Lihat detail transaksi
              </Link>
              {transaction.stock?.content ? (
                <div className="rounded-lg bg-secondary p-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Item Digital Diterima</p>
                  <pre className="whitespace-pre-wrap break-all text-sm">{transaction.stock.content}</pre>
                </div>
              ) : (
                <p className="text-muted-foreground">Item digital akan muncul setelah pembayaran PAID.</p>
              )}
            </CardContent>
          </Card>
        ))}

        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Belum ada transaksi.</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
