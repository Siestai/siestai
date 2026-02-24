import React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "@/components/layout/nav-bar";
import { StatusBar } from "@/components/layout/status-bar";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Siestai - AI Agent Platform",
  description:
    "Build, deploy, and interact with AI agents. Create multi-agent conversations, live chats, and agent-to-agent interactions.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-background`}
      >
        <div className="flex min-h-screen flex-col">
          <NavBar />
          <main className="flex-1 pb-10">{children}</main>
          <StatusBar />
        </div>
      </body>
    </html>
  );
}
