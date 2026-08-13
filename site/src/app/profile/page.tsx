import Image from "next/image";
import Link from "next/link";
import { ProfileSetup } from "@/components/ProfileSetup";
import { ChallengeInbox } from "@/components/ChallengeInbox";
import { WalletButton } from "@/components/WalletButton";
import { SponsorOffers } from "@/components/SponsorOffers";

export default function ProfilePage() {
  return (
    <main className="profile-editor-page">
      <header className="nav shell">
        <Link className="brand" href="/"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link>
        <nav><Link href="/arena">Live Arena</Link><Link href="/moves">Move Cinema</Link><Link href="/game">Game Lab</Link><Link href="/founder">Profile Demo</Link></nav><WalletButton />
      </header>
      <section className="profile-editor-hero shell">
        <p className="eyebrow">CONNECTED OWNER PROFILE</p>
        <h1>Your Goons.<br />Your name.<br /><i>Their highlight reel.</i></h1>
        <p>Create the public URL that displays every Goon currently owned by your verified wallet. Movie progress follows each NFT if it changes hands.</p>
      </section>
      <section className="shell profile-editor-workspace"><ProfileSetup /><SponsorOffers/><ChallengeInbox /></section>
    </main>
  );
}
