import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi, writeAdminAuditLog } from "@/lib/admin";

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  base_price: z.coerce.number().int().positive(),
  is_active: z.boolean().default(true)
});

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const products = await prisma.product.findMany({
    include: {
      _count: {
        select: {
          stockItems: true,
          transactions: true
        }
      }
    },
    orderBy: { id: "desc" }
  });

  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const payload = createSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      title: payload.data.title,
      description: payload.data.description,
      base_price: payload.data.base_price,
      is_active: payload.data.is_active
    }
  });

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "CREATE_PRODUCT",
    targetType: "Product",
    targetId: product.id,
    details: `title=${product.title}`
  });

  return NextResponse.json(product, { status: 201 });
}
