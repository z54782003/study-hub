import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 多読的 PDF 沒有 CORS，經同網域轉給 tadoku.org 才能在頁面裡用 pdf.js 顯示（內容原封不動）。
  // 用 rewrite 而不是 API route：PDF 可能超過函式回應的大小上限。登入檢查照樣由 middleware 先做。
  async rewrites() {
    return [{ source: "/tadoku-pdf/:path*", destination: "https://tadoku.org/japanese/wp-content/uploads/:path*" }];
  },
};

export default nextConfig;
