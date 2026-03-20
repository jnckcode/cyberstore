import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi, writeAdminAuditLog } from "@/lib/admin";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const patchSchema = z.object({
  role: z.enum(["ADMIN", "USER"]).optional(),
  is_verified: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (parsedParams.data.id === auth.adminId) {
    return NextResponse.json({ error: "Cannot modify your own admin role from this endpoint" }, { status: 409 });
  }

  const parsedPayload = patchSchema.safeParse(await request.json());
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: parsedParams.data.id },
    data: parsedPayload.data
  });

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "UPDATE_USER",
    targetType: "User",
    targetId: updated.id,
    details: JSON.stringify(parsedPayload.data)
  });

  return NextResponse.json(updated);
}
