import type { Metadata } from "next";
import { Lora, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "News Shore — Your Trusted Source for Breaking News",
  description:
    "Stay informed with News Shore. Get the latest breaking news, in-depth analysis, and comprehensive coverage of technology, business, sports, health, and more.",
  keywords: [
    "news",
    "breaking news",
    "technology",
    "business",
    "sports",
    "health",
    "world news",
    "News Shore",
  ],
  authors: [{ name: "News Shore Editorial Team" }],
  icons: {
    icon: "/logo-icon.png",
  },
  openGraph: {
    title: "News Shore — Your Trusted Source for Breaking News",
    description:
      "Stay informed with the latest breaking news, in-depth analysis, and comprehensive coverage.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${lora.variable} ${dmSans.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
