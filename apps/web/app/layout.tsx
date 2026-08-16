import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { AppShell } from "../src/components/shell/app-shell";
import { BreadcrumbProvider } from "../src/components/shell/breadcrumb-context";
import { TooltipProvider } from "../src/components/ui/tooltip";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

export const metadata: Metadata = {
  description: "Operational bridge portfolio management.",
  title: {
    default: "Bridge OS",
    template: "%s | Bridge OS"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang="en">
      <body className="font-sans antialiased">
        <TooltipProvider>
          <BreadcrumbProvider>
            <AppShell>{children}</AppShell>
          </BreadcrumbProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
