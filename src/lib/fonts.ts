import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

// Display: variable serif with optical-size and SOFT axes — characterful editorial feel.
export const fontDisplay = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

// UI sans: technical, slightly mechanical — pairs with the airline-ops voice.
export const fontSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Mono: tabular numerals for cash, schedules, IATA codes.
export const fontMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const fontVariables = `${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`;
