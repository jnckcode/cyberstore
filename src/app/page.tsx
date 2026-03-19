import { getServerSession } from "next-auth";

import { CheckoutButton } from "@/components/checkout-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [session, products] = await Promise.all([
    getServerSession(authOptions),
    prisma.product.findMany({
      where: { is_active: true },
      orderBy: { id: "desc" }
    })
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/20 bg-white/35 p-8 shadow-xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/45">
        <h1 className="text-3xl font-bold tracking-tight">Digital Product Marketplace</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Pilih produk, checkout dengan nominal unik, dan item digital otomatis dikirim saat pembayaran terverifikasi.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle className="line-clamp-1">{product.title}</CardTitle>
              <CardDescription className="line-clamp-2">{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="secondary">Rp {product.base_price.toLocaleString("id-ID")}</Badge>
              <CheckoutButton productId={product.id} isLoggedIn={Boolean(session?.user)} />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
