import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [totalUsers, totalProducts, totalReadyStock, pendingTransactions, paidTransactions, latestTransactions] =
    await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.stockItem.count({
        where: {
          status: "READY",
          owner_id: null
        }
      }),
      prisma.transaction.count({
        where: {
          status: "PENDING"
        }
      }),
      prisma.transaction.count({
        where: {
          status: "PAID"
        }
      }),
      prisma.transaction.findMany({
        include: {
          user: true,
          product: true
        },
        orderBy: {
          created_at: "desc"
        },
        take: 20
      })
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{totalUsers}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Produk</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{totalProducts}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Ready Stock</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{totalReadyStock}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Transaksi Pending</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{pendingTransactions}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Transaksi Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{paidTransactions}</CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>20 Transaksi Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {latestTransactions.map((transaction) => (
            <div key={transaction.id} className="rounded-md border border-border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-semibold">#{transaction.id} - {transaction.product.title}</p>
                <Badge variant={transaction.status === "PAID" ? "default" : "outline"}>{transaction.status}</Badge>
              </div>
              <p className="text-muted-foreground">User: {transaction.user.email}</p>
              <p className="text-muted-foreground">Total: Rp {transaction.total_price.toLocaleString("id-ID")}</p>
              <p className="text-muted-foreground">
                Dibuat: {new Date(transaction.created_at).toLocaleString("id-ID")}
              </p>
            </div>
          ))}

          {latestTransactions.length === 0 ? (
            <p className="text-muted-foreground">Belum ada transaksi.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
