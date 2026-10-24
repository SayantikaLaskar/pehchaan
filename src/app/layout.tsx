import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Noto_Sans_Kannada } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic"], variable: "--font-serif" });
const kn = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-kn" });

export const metadata: Metadata = {
  title: "Hisaab Kavach — Safe to accept UPI",
  description: "AI bookkeeping and tax shield for Paytm merchants. Separates real sales from family money, loans and refunds.",
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
