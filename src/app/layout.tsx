import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Noto_Sans_Kannada } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic"], variable: "--font-serif" });
const kn = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-kn" });

export const metadata: Metadata = {
  title: "Pehchaan — Never lose a regular",
  description: "Customer intelligence for Paytm merchants: churn prediction from UPI payments, a Kannada win-back agent, and a neighbourhood radar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} ${kn.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
