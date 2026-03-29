import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f0f2f5] text-[#1a1a2e]" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
