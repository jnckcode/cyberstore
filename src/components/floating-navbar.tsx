"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function FloatingNavbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-5xl px-4">
      <div className="flex items-center justify-between rounded-2xl border border-white/25 bg-white/30 px-4 py-3 shadow-xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/40">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          CyberStore
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/" className="px-2 text-sm text-muted-foreground hover:text-foreground">
            Produk
          </Link>
          {session?.user ? (
            <>
              <Link href="/dashboard" className="px-2 text-sm text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/register">
                <Button variant="outline" size="sm">
                  Register
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm">Login</Button>
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
