import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Amp",
  description: "Amp: the marketing workspace where teams and their AI agents work toward shared goals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(manrope.variable, jetbrainsMono.variable)}>
      <body>{children}</body>
    </html>
  );
}
