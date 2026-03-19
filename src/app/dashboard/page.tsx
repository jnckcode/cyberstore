import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      user_id: Number(session.user.id)
    },
    include: {
      product: true,
      stock: true
    },
    orderBy: {
      created_at: "desc"
    }
  });

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard User</h1>

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
