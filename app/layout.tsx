import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "EVERYTHING BOT",
  description: "Личный Telegram-бот с планировщиком и полезными инструментами.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
