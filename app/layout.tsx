import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
export const metadata:Metadata={title:"EVERYTHING — Telegram Mini App",description:"Личная платформа в Telegram: финансы, планировщик, сообщество, маркетплейс и сообщения."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body><Script src="https://telegram.org/js/telegram-web-app.js?62" strategy="beforeInteractive"/>{children}</body></html>}