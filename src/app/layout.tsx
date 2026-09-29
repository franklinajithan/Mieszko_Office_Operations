import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mieszko Office Operations", description: "Multi-store office operations platform" };

export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
