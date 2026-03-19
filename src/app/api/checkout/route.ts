import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  productId: z.coerce.number().int().positive()
});

function pickUniqueCode(usedNominals: Set<number>, basePrice: number) {
  const candidates = Array.from({ length: 100 }, (_, index) => index + 1);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
  }

  const candidate = candidates.find((code) => !usedNominals.has(basePrice + code));
  return candidate ?? null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.isVerified) {
    return NextResponse.json({ error: "Email not verified" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId }
  });

  if (!product || !product.is_active) {
    return NextResponse.json({ error: "Product unavailable" }, { status: 404 });
  }

  const readyStockCount = await prisma.stockItem.count({
    where: {
      product_id: product.id,
      status: "READY",
      owner_id: null
    }
  });

  if (readyStockCount < 1) {
    return NextResponse.json({ error: "Stock is empty" }, { status: 409 });
  }

  await prisma.transaction.updateMany({
    where: {
      status: "PENDING",
      expires_at: {
        lte: new Date()
      }
    },
    data: {
      status: "EXPIRED"
    }
  });

  const pendingWithSameBase = await prisma.transaction.findMany({
    where: {
      status: "PENDING",
      base_price: product.base_price,
      expires_at: {
        gt: new Date()
      }
    },
    select: {
      total_price: true
    }
  });

  const usedNominals = new Set(pendingWithSameBase.map((item) => item.total_price));
  const uniqueCode = pickUniqueCode(usedNominals, product.base_price);

  if (uniqueCode === null) {
    return NextResponse.json(
      { error: "No available unique code for pending transactions" },
      { status: 409 }
    );
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const transaction = await prisma.transaction.create({
    data: {
      user_id: Number(session.user.id),
      product_id: product.id,
      base_price: product.base_price,
      unique_code: uniqueCode,
      total_price: product.base_price + uniqueCode,
      status: "PENDING",
      expires_at: expiresAt
    }
  });

  return NextResponse.json(
    {
      id: transaction.id,
      status: transaction.status,
      total_price: transaction.total_price,
      expires_at: transaction.expires_at
    },
    { status: 201 }
  );
}
