import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Impact Club — Pick Your Athlete",
  description: "1,000 selectable action-sports characters built to learn tricks.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
