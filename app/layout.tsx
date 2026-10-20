import type { Metadata } from "next";

import { display, sans, mono } from "@/lib/fonts"; // or "@/lib/fonts"
import "./globals.css";

export const metadata: Metadata = {
  title: "Nakami",
  description: "AI Agent Furniture Marketplace",
  icons: {
    icon: "/logo.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
