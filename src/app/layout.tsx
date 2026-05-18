import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "R6 Squad Room",
  description: "A Rainbow Six Siege stats dashboard for the squad.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
