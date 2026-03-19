"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("cyberstore-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
