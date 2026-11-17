import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KYRO — Everything. Connected.",
  description: "Твоё цифровое пространство для общения, покупок и новых возможностей.",
  applicationName: "KYRO",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
