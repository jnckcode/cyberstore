import { createHash, timingSafeEqual } from "crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type VerifyInput = {
  nominal: number;
  timestamp: number;
  signature: string;
  requestIp: string;
  source: "DANA_WEBHOOK" | "TASKER_DANA";
};

type VerifyResult =
  | {
      ok: true;
      status: 200;
      body: { ok: true; transaction_id: number; stock_id: number | null; status: "PAID" };
    }
  | {
      ok: false;
      status: 400 | 401 | 404 | 409 | 500;
      body: { error: string };
    };

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

async function logWebhookEvent(input: {
  nominal: number;
  timestamp: number;
  signature: string;
  requestIp: string;
  validationOk: boolean;
  processStatus: string;
  errorMessage?: string;
  transactionId?: number;
}) {
  await prisma.webhookEventLog.create({
    data: {
      nominal: input.nominal,
      timestamp: BigInt(input.timestamp),
      signature: input.signature,
      request_ip: input.requestIp,
      validation_ok: input.validationOk,
      process_status: input.processStatus,
      error_message: input.errorMessage,
      transaction_id: input.transactionId
    }
  });
}

export async function verifyAndAssignPayment(input: VerifyInput): Promise<VerifyResult> {
  const secret = process.env.TASKER_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 500,
      body: { error: "Server misconfigured" }
    };
  }

  if (Math.abs(Date.now() - input.timestamp) > 2 * 60 * 1000) {
    await logWebhookEvent({
      nominal: input.nominal,
      timestamp: input.timestamp,
      signature: input.signature,
      requestIp: input.requestIp,
      validationOk: false,
      processStatus: `${input.source}_EXPIRED_TIMESTAMP`,
      errorMessage: "Timestamp difference exceeds 2 minutes"
    });

    return {
      ok: false,
      status: 400,
      body: { error: "Request expired" }
    };
  }

  const expectedSignature = sha256(String(input.nominal) + String(input.timestamp) + secret);
  if (!secureEqual(input.signature, expectedSignature)) {
    await logWebhookEvent({
      nominal: input.nominal,
      timestamp: input.timestamp,
      signature: input.signature,
      requestIp: input.requestIp,
      validationOk: false,
      processStatus: `${input.source}_INVALID_SIGNATURE`,
      errorMessage: "Signature mismatch"
    });

    return {
      ok: false,
      status: 401,
      body: { error: "Invalid signature" }
    };
  }

  const replayKey = sha256(`${input.nominal}:${input.timestamp}:${input.signature}`);
  try {
    await prisma.webhookReplayGuard.create({
      data: {
        replay_key: replayKey
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await logWebhookEvent({
        nominal: input.nominal,
        timestamp: input.timestamp,
        signature: input.signature,
        requestIp: input.requestIp,
        validationOk: true,
        processStatus: `${input.source}_REPLAY_REJECTED`,
        errorMessage: "Duplicate replay key"
      });

      return {
        ok: false,
        status: 409,
        body: { error: "Replay request rejected" }
      };
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
          total_price: input.nominal,
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
          stock_id: assignedStockId,
          active_nominal: null
        }
      });

      return paidTransaction;
    });

    await logWebhookEvent({
      nominal: input.nominal,
      timestamp: input.timestamp,
      signature: input.signature,
      requestIp: input.requestIp,
      validationOk: true,
      processStatus: `${input.source}_PAID_ASSIGNED`,
      transactionId: result.id
    });

    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        transaction_id: result.id,
        stock_id: result.stock_id,
        status: "PAID"
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "PENDING_NOT_FOUND") {
      const paidInSameWindow = await prisma.transaction.findFirst({
        where: {
          status: "PAID",
          total_price: input.nominal,
          created_at: {
            gt: new Date(Date.now() - 30 * 60 * 1000)
          }
        },
        orderBy: {
          created_at: "desc"
        }
      });

      if (paidInSameWindow) {
        await logWebhookEvent({
          nominal: input.nominal,
          timestamp: input.timestamp,
          signature: input.signature,
          requestIp: input.requestIp,
          validationOk: true,
          processStatus: `${input.source}_ALREADY_PROCESSED`,
          transactionId: paidInSameWindow.id
        });

        return {
          ok: true,
          status: 200,
          body: {
            ok: true,
            transaction_id: paidInSameWindow.id,
            stock_id: paidInSameWindow.stock_id,
            status: "PAID"
          }
        };
      }

      await logWebhookEvent({
        nominal: input.nominal,
        timestamp: input.timestamp,
        signature: input.signature,
        requestIp: input.requestIp,
        validationOk: true,
        processStatus: `${input.source}_PENDING_NOT_FOUND`,
        errorMessage: message
      });

      return {
        ok: false,
        status: 404,
        body: { error: "Pending transaction not found" }
      };
    }

    if (message === "STOCK_NOT_AVAILABLE") {
      await logWebhookEvent({
        nominal: input.nominal,
        timestamp: input.timestamp,
        signature: input.signature,
        requestIp: input.requestIp,
        validationOk: true,
        processStatus: `${input.source}_STOCK_NOT_AVAILABLE`,
        errorMessage: message
      });

      return {
        ok: false,
        status: 409,
        body: { error: "Stock not available" }
      };
    }

    await logWebhookEvent({
      nominal: input.nominal,
      timestamp: input.timestamp,
      signature: input.signature,
      requestIp: input.requestIp,
      validationOk: true,
      processStatus: `${input.source}_UNEXPECTED_FAILURE`,
      errorMessage: message
    });

    return {
      ok: false,
      status: 500,
      body: { error: "Webhook processing failed" }
    };
  }
}

export async function logInvalidWebhookPayload(input: {
  source: "DANA_WEBHOOK" | "TASKER_DANA";
  nominal: number;
  timestamp: number;
  signature: string;
  requestIp: string;
  errorMessage: string;
}) {
  await logWebhookEvent({
    nominal: input.nominal,
    timestamp: input.timestamp,
    signature: input.signature,
    requestIp: input.requestIp,
    validationOk: false,
    processStatus: `${input.source}_INVALID_PAYLOAD`,
    errorMessage: input.errorMessage
  });
}
