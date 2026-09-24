import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Orchestra pass",
  description: "Your personalised admission pass for AO's online hackathon.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} ${inter.variable}`}><body className="bg-[oklch(0.153_0.006_107.1)] font-sans tracking-[-0.5px] text-[oklch(0.988_0.003_106.5)]">{children}</body></html>;
}
