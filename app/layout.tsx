import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { DatePickerActivator } from "@/components/date-picker-activator";

export const metadata: Metadata = {
  title: "Rapid Rise OS",
  description: "Internal CRM and business operating system for Rapid Rise AI.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><NavigationFeedback /><DatePickerActivator />{children}</body>
    </html>
  );
}
