import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gravity Goons — Live 1v1 Trick Matches",
  description: "Pick your Goon. Call the trick. Take the letters. Player USDC challenges are live; audience betting is coming soon.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Gravity Goons — Live 1v1 Trick Matches on Base",
    description: "Choose an exact-ID Gravity Goon and compete live across six disciplines. Player USDC challenges are live; audience betting is coming soon.",
    url: "https://gravitygoons.com/gooncade",
    siteName: "Gravity Goons",
    images: [{
      url: "/og-arcade-v2.png",
      width: 1200,
      height: 630,
      alt: "Six Gravity Goons competing in a neon arcade — live 1v1 trick matches with player USDC challenges",
    }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gravity Goons — Live 1v1 Trick Matches",
    description: "Pick your Goon. Call the trick. Take the letters. Player USDC challenges are live; audience betting is coming soon.",
    images: ["/og-arcade-v2.png"],
  },
};

export { default } from "../page";
