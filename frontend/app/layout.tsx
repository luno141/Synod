import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Synod — Multi-Agent Decision Intelligence",
  description:
    "A virtual advisory board powered by multiple AI agents. Get structured recommendations from VC, Engineering, Marketing, and Product perspectives.",
  keywords: ["AI", "decision intelligence", "multi-agent", "advisory board", "startup"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f0f2f5] text-[#1a1a2e]">
        {children}
      </body>
    </html>
  );
}
