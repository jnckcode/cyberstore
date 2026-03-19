import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { PaymentStatusPoller } from "@/components/payment-status-poller";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CheckoutQrisPage({
  params
}: {
  params: { transactionId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const transactionId = Number(params.transactionId);
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    notFound();
  }

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      user_id: Number(session.user.id)
    }
  });

  if (!transaction) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Bayar via QRIS</CardTitle>
          <CardDescription>
            Gunakan QRIS statis dan transfer persis sesuai nominal unik agar sistem bisa memetakan pembayaran.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-dashed border-border bg-background/40 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Static QRIS</p>
            <p className="mt-2 text-2xl font-bold">[ Tempel Gambar QRIS Statis ]</p>
          </div>

          <div className="rounded-lg bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Total yang harus dibayar</p>
            <p className="text-3xl font-bold text-primary">Rp {transaction.total_price.toLocaleString("id-ID")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Batas waktu: {new Date(transaction.expires_at).toLocaleString("id-ID")}</p>
          </div>

          <PaymentStatusPoller transactionId={transaction.id} />
        </CardContent>
      </Card>
    </div>
  );
}
