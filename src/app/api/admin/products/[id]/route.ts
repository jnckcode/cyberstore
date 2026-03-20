import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi, writeAdminAuditLog } from "@/lib/admin";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const patchSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  base_price: z.coerce.number().int().positive().optional(),
  is_active: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const parsedPayload = patchSchema.safeParse(await request.json());
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id: parsedParams.data.id },
    data: parsedPayload.data
  });

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "UPDATE_PRODUCT",
    targetType: "Product",
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
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const inUseTransactions = await prisma.transaction.count({
    where: { product_id: parsedParams.data.id }
  });
  if (inUseTransactions > 0) {
    return NextResponse.json({ error: "Product cannot be deleted because it has transactions" }, { status: 409 });
  }

  await prisma.stockItem.deleteMany({
    where: {
      product_id: parsedParams.data.id,
      owner_id: null,
      status: "READY"
    }
  });

  const deleted = await prisma.product.delete({
    where: { id: parsedParams.data.id }
  });

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "DELETE_PRODUCT",
    targetType: "Product",
    targetId: deleted.id,
    details: `title=${deleted.title}`
  });

  return NextResponse.json({ ok: true });
}
