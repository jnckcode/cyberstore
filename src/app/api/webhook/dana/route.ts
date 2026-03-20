import { NextResponse } from "next/server";
import { z } from "zod";

import { getClientIp } from "@/lib/security";
import { logInvalidWebhookPayload, verifyAndAssignPayment } from "@/lib/payment-verifier";

const webhookSchema = z.object({
  nominal: z.number().int().positive(),
  timestamp: z.number().int(),
  signature: z.string().min(1)
});

export async function POST(request: Request) {
  const requestIp = getClientIp(request);
  const rawPayload = await request.json();
  const payload = webhookSchema.safeParse(rawPayload);

  if (!payload.success) {
    await logInvalidWebhookPayload({
      source: "DANA_WEBHOOK",
      nominal: Number(rawPayload?.nominal ?? 0),
      timestamp: Number(rawPayload?.timestamp ?? 0),
      signature: String(rawPayload?.signature ?? "invalid"),
      requestIp,
      errorMessage: "Invalid payload format"
    });

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await verifyAndAssignPayment({
    nominal: payload.data.nominal,
    timestamp: payload.data.timestamp,
    signature: payload.data.signature,
    requestIp,
    source: "DANA_WEBHOOK"
  });

  return NextResponse.json(result.body, { status: result.status });
}
