import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CopySecretButton } from "@/components/copy-secret-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardTransactionDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const txId = Number(params.id);
  if (!Number.isInteger(txId) || txId <= 0) {
    notFound();
  }

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: txId,
      user_id: Number(session.user.id)
    },
    include: {
      product: true,
      stock: true
    }
  });

  if (!transaction) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Detail Transaksi #{transaction.id}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{transaction.product.title}</span>
            <Badge variant={transaction.status === "PAID" ? "default" : "outline"}>{transaction.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Base Price: Rp {transaction.base_price.toLocaleString("id-ID")}</p>
          <p>Unique Code: {transaction.unique_code}</p>
          <p>Total Price: Rp {transaction.total_price.toLocaleString("id-ID")}</p>
          <p>Created At: {new Date(transaction.created_at).toLocaleString("id-ID")}</p>
          <p>Expires At: {new Date(transaction.expires_at).toLocaleString("id-ID")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item Digital</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {transaction.stock?.content ? (
            <>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 text-sm">
                {transaction.stock.content}
              </pre>
              <CopySecretButton value={transaction.stock.content} />
            </>
          ) : (
            <p className="text-muted-foreground">Item digital tersedia setelah transaksi berstatus PAID.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
