// fonts.ts
// Add the three variables to your root layout's <body>, e.g.
//   <body className={`${display.variable} ${sans.variable} ${mono.variable} font-[family-name:var(--font-sans)]`}>
import { Fraunces, Inter, DM_Mono } from "next/font/google";

export const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
});

export const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});