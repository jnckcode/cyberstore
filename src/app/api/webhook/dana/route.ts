import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const webhookSchema = z.object({
  nominal: z.number().int().positive(),
  timestamp: z.number().int(),
  signature: z.string().min(1)
});

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function secureEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const secret = process.env.TASKER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const payload = webhookSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { nominal, timestamp, signature } = payload.data;
  if (Math.abs(Date.now() - timestamp) > 2 * 60 * 1000) {
    return NextResponse.json({ error: "Request expired" }, { status: 400 });
  }

  const expectedSignature = sha256(String(nominal) + String(timestamp) + secret);
  if (!secureEqual(signature, expectedSignature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: {
          status: "PENDING",
          total_price: nominal,
          expires_at: {
            gt: new Date()
          }
        },
        orderBy: {
          created_at: "asc"
        }
      });

      if (!transaction) {
        throw new Error("PENDING_NOT_FOUND");
      }

      let assignedStockId: number | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const stockItem = await tx.stockItem.findFirst({
          where: {
            product_id: transaction.product_id,
            status: "READY",
            owner_id: null
          },
          orderBy: {
            id: "asc"
          }
        });

        if (!stockItem) {
          break;
        }

        const claimed = await tx.stockItem.updateMany({
          where: {
            id: stockItem.id,
            status: "READY",
            owner_id: null
          },
          data: {
            status: "DELIVERED",
            owner_id: transaction.user_id
          }
        });

        if (claimed.count > 0) {
          assignedStockId = stockItem.id;
          break;
        }
      }

      if (!assignedStockId) {
        throw new Error("STOCK_NOT_AVAILABLE");
      }

      const paidTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "PAID",
          stock_id: assignedStockId
        }
      });

      return paidTransaction;
    });

    return NextResponse.json(
      {
        ok: true,
        transaction_id: result.id,
        stock_id: result.stock_id,
        status: result.status
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "PENDING_NOT_FOUND") {
      return NextResponse.json({ error: "Pending transaction not found" }, { status: 404 });
    }

    if (message === "STOCK_NOT_AVAILABLE") {
      return NextResponse.json({ error: "Stock not available" }, { status: 409 });
    }

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
