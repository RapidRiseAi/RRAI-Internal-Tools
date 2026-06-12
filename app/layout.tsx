import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { NavigationFeedback } from "@/components/navigation-feedback";

export const metadata: Metadata = {
  title: "Rapid Rise OS",
  description: "Internal CRM and business operating system for Rapid Rise AI.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><NavigationFeedback />{children}</body>
    </html>
  );
}
