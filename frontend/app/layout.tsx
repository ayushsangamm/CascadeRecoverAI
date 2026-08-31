import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "CascadeRecover AI — Razorpay Buildathon 2024",
  description:
    "Autonomous AI Revenue Recovery System. Real-time GMV recovery dashboard powered by Google Gemini AI — Razorpay AI Buildathon Track 3.",
  keywords: ["AI", "Revenue Recovery", "Razorpay", "Fintech", "Payment Recovery"],
  openGraph: {
    title: "CascadeRecover AI",
    description: "Autonomous AI Revenue Recovery System — Razorpay AI Buildathon 2024",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0B0F17] text-slate-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
