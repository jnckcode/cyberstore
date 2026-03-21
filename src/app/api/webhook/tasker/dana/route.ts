import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logInvalidWebhookPayload, verifyAndAssignPayment } from "@/lib/payment-verifier";
import { getClientIp } from "@/lib/security";

const taskerPayloadSchema = z.object({
  message: z.string().optional(),
  text: z.string().optional(),
  body: z.string().optional(),
  notification: z.string().optional(),
  timestamp: z.coerce.number().int().optional(),
  ts: z.coerce.number().int().optional(),
  time: z.coerce.number().int().optional(),
  signature: z.string().optional(),
  token: z.string().optional(),
  title: z.string().optional(),
  app: z.string().optional(),
  nltitle: z.string().optional(),
  nltext: z.string().optional()
});

function parseDanaMessageNominal(message: string) {
  const match = message.match(/Rp\s*([\d.,]+)/i);
  if (!match) {
    return null;
  }

  const numeric = match[1].replace(/\./g, "").replace(/,/g, ".");
  const amount = Number.parseFloat(numeric);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount);
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/webhook/tasker/dana",
      method: "POST",
      expected_content_type: ["application/json", "application/x-www-form-urlencoded", "text/plain"],
      expected_fields: ["message", "timestamp", "signature(optional)", "token(optional)"]
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const requestIp = getClientIp(request);
  const contentType = request.headers.get("content-type") ?? "";
  let rawPayload: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    rawPayload = (await request.json()) as Record<string, unknown>;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    for (const [key, value] of formData.entries()) {
      rawPayload[key] = String(value);
    }
  } else {
    const text = await request.text();
    rawPayload = { message: text };
  }

  const parsed = taskerPayloadSchema.safeParse(rawPayload);
  const data = parsed.success ? parsed.data : {};

  const message = [
    data.message,
    data.text,
    data.body,
    data.notification,
    data.nltext,
    typeof rawPayload.message === "string" ? rawPayload.message : undefined,
    typeof rawPayload.text === "string" ? rawPayload.text : undefined,
    typeof rawPayload.body === "string" ? rawPayload.body : undefined,
    typeof rawPayload.notification === "string" ? rawPayload.notification : undefined,
    typeof rawPayload.nltext === "string" ? rawPayload.nltext : undefined,
    typeof rawPayload.evtprm3 === "string" ? rawPayload.evtprm3 : undefined
  ]
    .map((candidate) => (candidate ?? "").trim())
    .find((candidate) => candidate.length > 0) ?? "";

  const timestampCandidate =
    data.timestamp ??
    data.ts ??
    data.time ??
    Number(rawPayload.timestamp ?? rawPayload.ts ?? rawPayload.time ?? Date.now());

  const timestamp = Number.isFinite(timestampCandidate) ? Math.trunc(timestampCandidate) : Date.now();

  if (!message) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal: 0,
      timestamp,
      signature: String(rawPayload?.signature ?? "invalid"),
      requestIp,
      errorMessage: "Notification message is empty"
    });

    return NextResponse.json(
      {
        error: "Invalid payload",
        hint: "Missing message/text/body/notification field"
      },
      { status: 400 }
    );
  }

  const nominal = parseDanaMessageNominal(message);
  if (!nominal) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal: 0,
      timestamp,
      signature: String(data.signature ?? rawPayload.signature ?? "missing"),
      requestIp,
      errorMessage: "Cannot parse nominal from notification message"
    });

    return NextResponse.json({ error: "Nominal not found in notification message" }, { status: 400 });
  }

  const taskerTokenHeader = request.headers.get("x-tasker-token");
  const taskerTokenQuery = new URL(request.url).searchParams.get("token");
  const taskerToken = process.env.TASKER_PROFILE_TOKEN?.trim();
  const tokenCandidate =
    taskerTokenHeader ?? data.token ?? (typeof rawPayload.token === "string" ? rawPayload.token : undefined) ?? taskerTokenQuery ?? "";
  const tokenAuthorized = Boolean(taskerToken && tokenCandidate && tokenCandidate === taskerToken);

  const signature =
    data.signature ?? (typeof rawPayload.signature === "string" ? rawPayload.signature : undefined);
  if (!signature && !tokenAuthorized) {
    await logInvalidWebhookPayload({
      source: "TASKER_DANA",
      nominal,
      timestamp,
      signature: "missing",
      requestIp,
      errorMessage: "Missing signature and invalid tasker token"
    });

    return NextResponse.json({ error: "Unauthorized tasker callback" }, { status: 401 });
  }

  const finalSignature =
    signature ??
    (process.env.TASKER_SECRET
      ? createHash("sha256")
          .update(String(nominal) + String(timestamp) + process.env.TASKER_SECRET)
          .digest("hex")
      : "");

  if (!finalSignature) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const result = await verifyAndAssignPayment({
    nominal,
    timestamp,
    signature: finalSignature,
    requestIp,
    source: "TASKER_DANA"
  });

  return NextResponse.json(result.body, { status: result.status });
}
