import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EVERYTHING — сервисы в Telegram",
  description: "Финансы и планировщик в интерактивных сообщениях Telegram.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
