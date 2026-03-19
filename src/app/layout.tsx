import type { Metadata } from "next";

import "@/app/globals.css";
import { FloatingNavbar } from "@/components/floating-navbar";
import { AppSessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
  title: "CyberStore",
  description: "Web Store Produk Digital"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AppSessionProvider>
          <FloatingNavbar />
          <main className="container mt-8 pb-10">{children}</main>
        </AppSessionProvider>
      </body>
    </html>
  );
}
