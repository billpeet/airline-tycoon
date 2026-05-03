import type { Metadata } from "next";
import { fontDisplay, fontMono, fontSans } from "@/lib/fonts";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airline Tycoon",
  description: "An idle airline-management tycoon. Build a fictional carrier inside the real-world industry.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <TooltipProvider delay={120}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
