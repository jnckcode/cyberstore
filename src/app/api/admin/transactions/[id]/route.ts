import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi, writeAdminAuditLog } from "@/lib/admin";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const patchSchema = z.object({
  status: z.enum(["PENDING", "PAID", "EXPIRED"])
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  const parsedPayload = patchSchema.safeParse(await request.json());
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.transaction.findUnique({
    where: { id: parsedParams.data.id },
    select: { id: true, total_price: true }
  });

  if (!existing) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const transaction = await prisma.transaction.update({
    where: { id: parsedParams.data.id },
    data: {
      status: parsedPayload.data.status,
      active_nominal: parsedPayload.data.status === "PENDING" ? existing.total_price : null
    }
  });

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "UPDATE_TRANSACTION_STATUS",
    targetType: "Transaction",
    targetId: transaction.id,
    details: `status=${transaction.status}`
  });

  return NextResponse.json(transaction);
}
