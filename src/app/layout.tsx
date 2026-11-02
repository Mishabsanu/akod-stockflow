import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * Fonts come from a Google Fonts stylesheet rather than next/font: next/font/google fails to build
 * on Vercel with Next 16.3 + Turbopack ("next/font/google queries have exactly one entry").
 */
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

export const metadata: Metadata = {
  title: { default: "AKOD Commerce", template: "%s | AKOD Commerce" },
  description: "AKOD Commerce — products, inventory, marketplace / local / distributor orders and finance",
};

export const viewport: Viewport = {
  themeColor: "#5439a3",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_HREF} />
      </head>
      <body
        className="antialiased font-sans bg-canvas text-slate-900 selection:bg-brand selection:text-white"
        suppressHydrationWarning
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
