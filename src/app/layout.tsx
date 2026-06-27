import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "blog",
  description: "ryu さん個人のブログ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col bg-white text-gray-900">
        <header className="border-b border-gray-200">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold">
              blog
            </Link>
            <nav>
              <Link
                href="/posts"
                className="text-sm text-gray-600 hover:underline"
              >
                記事一覧
              </Link>
            </nav>
          </div>
        </header>
        {/*
          注意: ここを <main> にすると、既存ページ (/posts, /posts/[slug],
          /admin/posts/**, /login) が自前で <main> を返している既存実装と
          二重 nest になり HTML5 landmark を壊す。layout 側は単なる
          flex コンテナとして <div className="flex-1"> に留め、各 page の
          <main> を真の main landmark として残す。
        */}
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-200">
          <div className="mx-auto max-w-3xl px-6 py-6 text-sm text-gray-500">
            © {year} blog
          </div>
        </footer>
      </body>
    </html>
  );
}
