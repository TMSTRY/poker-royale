import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Royale — Texas Hold'em",
  description:
    "Speel Texas Hold'em tegen vijf eigenzinnige bots. Toernooiformat, stijgende blinds, echte pot-odds. Winner takes all.",
  applicationName: "Poker Royale",
  openGraph: {
    title: "Poker Royale — Texas Hold'em",
    description: "Toernooipoker tegen vijf bots. Winner takes all.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07120d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
