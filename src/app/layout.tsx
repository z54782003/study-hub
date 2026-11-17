import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Study Hub",
  description: "每日學習清單：日文・英文・閱讀",
  manifest: "/manifest.webmanifest",
  // iOS 的主畫面圖示不吃 SVG，要 PNG
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Study", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-dvh font-sans antialiased">
        <OfflineBanner />
        <main className="mx-auto max-w-xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-28 md:max-w-[760px]">
          {children}
        </main>
        <BottomNav />
        <ServiceWorker />
      </body>
    </html>
  );
}
