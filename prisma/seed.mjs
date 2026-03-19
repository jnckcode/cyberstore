import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = [
    {
      title: "Canva Pro 1 Bulan",
      description: "Akun Canva Pro private untuk 1 bulan.",
      base_price: 35000,
      is_active: true,
      stock: [
        "email:canva1@mail.com|pass:secure123",
        "email:canva2@mail.com|pass:secure123",
        "email:canva3@mail.com|pass:secure123"
      ]
    },
    {
      title: "Netflix Sharing 1 Profile",
      description: "Akses 1 profile Netflix selama 30 hari.",
      base_price: 45000,
      is_active: true,
      stock: [
        "email:nfx1@mail.com|pass:movie123|pin:1111",
        "email:nfx2@mail.com|pass:movie123|pin:2222",
        "email:nfx3@mail.com|pass:movie123|pin:3333"
      ]
    }
  ];

  for (const productData of products) {
    const existedProduct = await prisma.product.findFirst({
      where: { title: productData.title },
      select: { id: true }
    });

    const product = existedProduct
      ? await prisma.product.update({
          where: { id: existedProduct.id },
          data: {
            description: productData.description,
            base_price: productData.base_price,
            is_active: productData.is_active
          }
        })
      : await prisma.product.create({
          data: {
            title: productData.title,
            description: productData.description,
            base_price: productData.base_price,
            is_active: productData.is_active
          }
        });

    for (const content of productData.stock) {
      const exists = await prisma.stockItem.findFirst({
        where: {
          product_id: product.id,
          content
        },
        select: { id: true }
      });

      if (!exists) {
        await prisma.stockItem.create({
          data: {
            product_id: product.id,
            content,
            status: "READY"
          }
        });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
