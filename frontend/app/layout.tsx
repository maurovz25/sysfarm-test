import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import QueryProvider from "@/components/providers/query-provider"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "SysFarm",
  description: "Sistema completo de gestión de inventario con control de productos, ingresos, salidas y Kardex",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-square.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon-square.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <QueryProvider>
          {children}
          <Toaster position="top-right" richColors duration={20000} closeButton />
        </QueryProvider>
      </body>
    </html>
  )
}

