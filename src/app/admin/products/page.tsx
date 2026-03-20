"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ProductRow = {
  id: number;
  title: string;
  description: string;
  base_price: number;
  is_active: boolean;
  _count: { stockItems: number; transactions: number };
};

export default function AdminProductsPage() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", base_price: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/products");
    const data = (await response.json()) as ProductRow[];
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createProduct = async () => {
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        base_price: Number(form.base_price),
        is_active: true
      })
    });

    if (!response.ok) {
      alert("Gagal menambah produk");
      return;
    }

    setForm({ title: "", description: "", base_price: "" });
    await load();
  };

  const toggleActive = async (product: ProductRow) => {
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !product.is_active })
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Products</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tambah Produk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <Input
            placeholder="Base price"
            type="number"
            value={form.base_price}
            onChange={(event) => setForm((prev) => ({ ...prev, base_price: event.target.value }))}
          />
          <Button onClick={() => void createProduct()}>Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loading ? <p>Loading...</p> : null}
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3">
              <p className="font-semibold">{item.title}</p>
              <p className="text-muted-foreground">{item.description}</p>
              <p>Harga: Rp {item.base_price.toLocaleString("id-ID")}</p>
              <p>
                Stocks: {item._count.stockItems} | Transactions: {item._count.transactions}
              </p>
              <Button size="sm" variant="outline" onClick={() => void toggleActive(item)}>
                {item.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          ))}
          {items.length === 0 ? <p className="text-muted-foreground">Belum ada produk.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
