import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminApi, writeAdminAuditLog } from "@/lib/admin";

const querySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  status: z.enum(["READY", "DELIVERED", "EXPIRED"]).optional()
});

const createSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  contents: z.array(z.string().min(1)).min(1)
});

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    productId: url.searchParams.get("productId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const stocks = await prisma.stockItem.findMany({
    where: {
      product_id: parsed.data.productId,
      status: parsed.data.status
    },
    include: {
      product: true,
      owner: true
    },
    orderBy: {
      id: "desc"
    },
    take: 300
  });

  return NextResponse.json(stocks);
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

  const created = await prisma.$transaction(
    payload.data.contents.map((content) =>
      prisma.stockItem.create({
        data: {
          product_id: payload.data.product_id,
          content,
          status: "READY"
        }
      })
    )
  );

  await writeAdminAuditLog({
    adminUserId: auth.adminId,
    action: "BULK_CREATE_STOCK",
    targetType: "StockItem",
    details: `product_id=${payload.data.product_id}, count=${created.length}`
  });

  return NextResponse.json({ created: created.length }, { status: 201 });
}
