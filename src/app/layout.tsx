import type { Metadata } from "next";
import { Montserrat, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Division E - District 229 | Toastmasters Digital Hub",
  description: "The central hub for Division E, District 229 Toastmasters. Resources, events, and leadership tools for public speaking excellence in Chennai.",
  keywords: ["Toastmasters District 229", "Public Speaking Chennai", "Division E Toastmasters", "Leadership Training", "Chennai Speakers"],
  openGraph: {
    title: "Division E - District 229 | Toastmasters Digital Hub",
    description: "Empowering leaders and speakers across Division E, District 229.",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
