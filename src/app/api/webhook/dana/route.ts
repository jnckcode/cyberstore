import { createHash, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/security";

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
  const requestIp = getClientIp(request);
  const secret = process.env.TASKER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const rawPayload = await request.json();
  const payload = webhookSchema.safeParse(rawPayload);
  if (!payload.success) {
    await prisma.webhookEventLog.create({
      data: {
        nominal: Number(rawPayload?.nominal ?? 0),
        timestamp: BigInt(Number(rawPayload?.timestamp ?? 0)),
        signature: String(rawPayload?.signature ?? "invalid"),
        request_ip: requestIp,
        validation_ok: false,
        process_status: "INVALID_PAYLOAD",
        error_message: "Invalid payload format"
      }
    });

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { nominal, timestamp, signature } = payload.data;
  if (Math.abs(Date.now() - timestamp) > 2 * 60 * 1000) {
    await prisma.webhookEventLog.create({
      data: {
        nominal,
        timestamp: BigInt(timestamp),
        signature,
        request_ip: requestIp,
        validation_ok: false,
        process_status: "EXPIRED_TIMESTAMP",
        error_message: "Timestamp difference exceeds 2 minutes"
      }
    });

    return NextResponse.json({ error: "Request expired" }, { status: 400 });
  }

  const expectedSignature = sha256(String(nominal) + String(timestamp) + secret);
  if (!secureEqual(signature, expectedSignature)) {
    await prisma.webhookEventLog.create({
      data: {
        nominal,
        timestamp: BigInt(timestamp),
        signature,
        request_ip: requestIp,
        validation_ok: false,
        process_status: "INVALID_SIGNATURE",
        error_message: "Signature mismatch"
      }
    });

    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const replayKey = sha256(`${nominal}:${timestamp}:${signature}`);
  try {
    await prisma.webhookReplayGuard.create({
      data: {
        replay_key: replayKey
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await prisma.webhookEventLog.create({
        data: {
          nominal,
          timestamp: BigInt(timestamp),
          signature,
          request_ip: requestIp,
          validation_ok: true,
          process_status: "REPLAY_REJECTED",
          error_message: "Duplicate replay key"
        }
      });

      return NextResponse.json({ error: "Replay request rejected" }, { status: 409 });
    }

    throw error;
  }

  try {
    await prisma.webhookReplayGuard.deleteMany({
      where: {
        created_at: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

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

    await prisma.webhookEventLog.create({
      data: {
        nominal,
        timestamp: BigInt(timestamp),
        signature,
        request_ip: requestIp,
        validation_ok: true,
        process_status: "PAID_ASSIGNED",
        transaction_id: result.id
      }
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
      await prisma.webhookEventLog.create({
        data: {
          nominal,
          timestamp: BigInt(timestamp),
          signature,
          request_ip: requestIp,
          validation_ok: true,
          process_status: "PENDING_NOT_FOUND",
          error_message: message
        }
      });

      return NextResponse.json({ error: "Pending transaction not found" }, { status: 404 });
    }

    if (message === "STOCK_NOT_AVAILABLE") {
      await prisma.webhookEventLog.create({
        data: {
          nominal,
          timestamp: BigInt(timestamp),
          signature,
          request_ip: requestIp,
          validation_ok: true,
          process_status: "STOCK_NOT_AVAILABLE",
          error_message: message
        }
      });

      return NextResponse.json({ error: "Stock not available" }, { status: 409 });
    }

    await prisma.webhookEventLog.create({
      data: {
        nominal,
        timestamp: BigInt(timestamp),
        signature,
        request_ip: requestIp,
        validation_ok: true,
        process_status: "UNEXPECTED_FAILURE",
        error_message: message
      }
    });

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
