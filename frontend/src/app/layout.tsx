// frontend/src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import TerminalFrame from "@/components/TerminalFrame";
import { Kalam, Patrick_Hand } from "next/font/google";

const fontKalam = Kalam({
  weight: ["700"],
  subsets: ["latin"],
  variable: "--font-kalam",
});

const fontPatrick = Patrick_Hand({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-patrick-hand",
});

export const metadata: Metadata = {
  title: "FlatTrack - Hand-Drawn Expense Planner",
  description: "Playful, organic flatmate expense tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontKalam.variable} ${fontPatrick.variable}`}>
      <body className="bg-paper-bg text-paper-text font-patrick min-h-screen">
        <AuthProvider>
          <TerminalFrame>{children}</TerminalFrame>
        </AuthProvider>
      </body>
    </html>
  );
}
