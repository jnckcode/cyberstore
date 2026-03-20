"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProductRef = { id: number; title: string };
type StockRow = {
  id: number;
  content: string;
  status: "READY" | "DELIVERED" | "EXPIRED";
  product: ProductRef;
  owner: { email: string } | null;
};

export default function AdminStocksPage() {
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [productId, setProductId] = useState("");
  const [bulkContent, setBulkContent] = useState("");

  const load = useCallback(async () => {
    const [productsResponse, stocksResponse] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/stocks")
    ]);

    const productsData = (await productsResponse.json()) as Array<{ id: number; title: string }>;
    setProducts(productsData.map((item) => ({ id: item.id, title: item.title })));

    const stocksData = (await stocksResponse.json()) as StockRow[];
    setStocks(stocksData);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createBulk = async () => {
    if (!productId) {
      alert("Pilih produk");
      return;
    }

    const lines = bulkContent
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const response = await fetch("/api/admin/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: Number(productId),
        contents: lines
      })
    });

    if (!response.ok) {
      alert("Gagal menambah stock");
      return;
    }

    setBulkContent("");
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Stocks</h1>

      <Card>
        <CardHeader>
          <CardTitle>Tambah Stock (Bulk)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Pilih Produk</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-28 w-full rounded-md border border-input bg-background/80 p-3 text-sm"
            placeholder="Satu baris satu stock item"
            value={bulkContent}
            onChange={(event) => setBulkContent(event.target.value)}
          />
          <Button onClick={() => void createBulk()}>Tambah Bulk Stock</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {stocks.map((stock) => (
            <div key={stock.id} className="rounded-md border border-border p-3">
              <p className="font-semibold">#{stock.id} - {stock.product.title}</p>
              <p className="text-muted-foreground">{stock.content}</p>
              <p>Status: {stock.status}</p>
              <p>Owner: {stock.owner?.email ?? "-"}</p>
            </div>
          ))}
          {stocks.length === 0 ? <p className="text-muted-foreground">Belum ada stock.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
