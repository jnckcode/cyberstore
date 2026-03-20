import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi, writeAdminAuditLog } from "@/lib/admin";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const patchSchema = z.object({
  status: z.enum(["READY", "DELIVERED", "EXPIRED"]).optional(),
  content: z.string().min(1).optional()
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid stock id" }, { status: 400 });
  }

  const parsedPayload = patchSchema.safeParse(await request.json());
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.stockItem.update({
    where: { id: parsedParams.data.id },
    data: parsedPayload.data
  });

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "UPDATE_STOCK",
    targetType: "StockItem",
    targetId: updated.id,
    details: JSON.stringify(parsedPayload.data)
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid stock id" }, { status: 400 });
  }

  const stock = await prisma.stockItem.findUnique({
    where: { id: parsedParams.data.id },
    include: {
      transaction: true
    }
  });

  if (!stock) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  if (stock.transaction) {
    return NextResponse.json({ error: "Stock cannot be deleted because it is linked to transaction" }, { status: 409 });
  }

  await prisma.stockItem.delete({
    where: { id: parsedParams.data.id }
  });

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "DELETE_STOCK",
    targetType: "StockItem",
    targetId: parsedParams.data.id
  });

  return NextResponse.json({ ok: true });
}
