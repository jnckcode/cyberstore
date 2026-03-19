"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CheckoutButton({ productId, isLoggedIn }: { productId: number; isLoggedIn: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const onCheckout = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });

      if (!response.ok) {
        throw new Error("Checkout gagal");
      }

      const data = (await response.json()) as { id: number };
      router.push(`/checkout/${data.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout gagal";
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button disabled={!isLoggedIn || isLoading} onClick={onCheckout} className="w-full">
      {!isLoggedIn ? "Login untuk checkout" : isLoading ? "Membuat transaksi..." : "Checkout Sekarang"}
    </Button>
  );
}
