import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { PaymentStatusPoller } from "@/components/payment-status-poller";
import { CopySecretButton } from "@/components/copy-secret-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDynamicQrisString, buildQrisDataUrl } from "@/lib/qris";

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

  const baseQrisString = process.env.BASE_QRIS_STRING?.trim() ?? "";
  const dynamicQrisString = baseQrisString
    ? buildDynamicQrisString(baseQrisString, transaction.total_price)
    : null;
  const qrisDataUrl = dynamicQrisString ? await buildQrisDataUrl(dynamicQrisString) : null;

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Bayar via QRIS</CardTitle>
          <CardDescription>
            QRIS otomatis dibentuk dengan nominal unik transaksi ini, jadi setiap user menerima payload QR berbeda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-dashed border-border bg-background/40 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Dynamic QRIS</p>
            {qrisDataUrl ? (
              <Image
                src={qrisDataUrl}
                alt="QRIS pembayaran"
                width={260}
                height={260}
                className="mx-auto mt-3 w-full max-w-[260px] rounded-md"
                unoptimized
              />
            ) : (
              <p className="mt-2 text-sm text-red-500">
                BASE_QRIS_STRING belum di-set pada environment server.
              </p>
            )}
          </div>

          {dynamicQrisString ? (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Dynamic QRIS Payload</p>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all text-xs">{dynamicQrisString}</pre>
              <div className="mt-2">
                <CopySecretButton value={dynamicQrisString} />
              </div>
            </div>
          ) : null}

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
