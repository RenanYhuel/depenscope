import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DepenScope",
  description: "Generate shematics for dependancies between files and librairies in your Github Repository",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
