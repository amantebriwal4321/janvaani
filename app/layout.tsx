import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Bengali, Noto_Sans_Devanagari, Noto_Sans_Gurmukhi, Noto_Sans_Kannada, Noto_Sans_Telugu, Geist_Mono } from "next/font/google";
import "./globals.css";

// All faces are self-hosted from /_next/static/media with font-display: swap.
// Only the Latin face is preloaded; the Indic and mono faces load on demand via
// @font-face so they do not compete with the JS chunks on a narrow tunnel.
const sans = Noto_Sans({ variable: "--font-sans-base", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"] });
const dev = Noto_Sans_Devanagari({ variable: "--font-dev", subsets: ["devanagari"], weight: ["400", "500", "600", "700"], preload: false });
const kan = Noto_Sans_Kannada({ variable: "--font-kan", subsets: ["kannada"], weight: ["400", "500", "600", "700"], preload: false });
const tel = Noto_Sans_Telugu({ variable: "--font-tel", subsets: ["telugu"], weight: ["400", "500", "600", "700"], preload: false });
const gur = Noto_Sans_Gurmukhi({ variable: "--font-gur", subsets: ["gurmukhi"], weight: ["400", "500", "600", "700"], preload: false });
const ben = Noto_Sans_Bengali({ variable: "--font-ben", subsets: ["bengali"], weight: ["400", "500", "600", "700"], preload: false });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "JanVaani - speak, and the government form fills itself",
  description: "Voice assistant that turns a citizen's story in Hindi, Kannada, Punjabi, Bhojpuri, Assamese, Telugu, Tamil, Marathi or English into filled welfare-scheme forms and a CSC Ready Slip. Built on SLNG.",
};

export const viewport: Viewport = { themeColor: "#f7f4ee", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${dev.variable} ${kan.variable} ${tel.variable} ${gur.variable} ${ben.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
