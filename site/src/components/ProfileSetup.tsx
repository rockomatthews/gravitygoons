"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { authenticateProfileSession, fetchWithTimeout, prepareProfileSignIn, type ProfileSignInChallenge } from "@/lib/profile-auth-client";
import { trackMarketingEvent } from "@/lib/analytics";

type ProfileRecord = { username: string; display_name: string; bio: string };

export function ProfileSetup() {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("Connect and sign once. The signature is free and cannot spend funds.");
  const [busy, setBusy] = useState(false);
  const [preparedChallenge, setPreparedChallenge] = useState<ProfileSignInChallenge | null>(null);

  useEffect(() => {
    fetch("/api/profile/me").then((response) => response.json()).then((data) => {
      setAuthenticated(Boolean(data.authenticated));
      if (data.profile) {
        setProfile(data.profile);
        setUsername(data.profile.username);
        setDisplayName(data.profile.display_name);
        setBio(data.profile.bio);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!account || authenticated) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setStatus("Preparing mobile wallet sign-in…");
      return prepareProfileSignIn(account);
    }).then((challenge) => {
      if (!active) return;
      setPreparedChallenge(challenge);
      setStatus("Sign-in ready. Press CONNECT + SIGN to approve it in your wallet.");
    }).catch((error) => {
      if (active) setStatus(error instanceof Error ? error.message : "Unable to prepare wallet sign-in.");
    });
    return () => { active = false; };
  }, [account, authenticated]);

  const preparedChallengeReady = Boolean(
    account
    && preparedChallenge
    && preparedChallenge.address.toLowerCase() === account.toLowerCase(),
  );

  async function signIn() {
    setBusy(true);
    try {
      const verified = await authenticateProfileSession({ account, connect, signMessage, signProfileChallenge, onStatus: setStatus, preparedChallenge });
      setAuthenticated(true);
      setPreparedChallenge(null);
      setStatus("Wallet verified. Refreshing your Goons…");
      let ownershipCount: number | null = null;
      try {
        const syncResponse = await fetchWithTimeout("/api/profile/sync", { method: "POST" }, 30_000);
        const synced = await syncResponse.json();
        if (syncResponse.ok) ownershipCount = synced.tokenIds.length;
      } catch { /* The manual refresh remains available if the index is temporarily unavailable. */ }
      if (verified.profile) {
        setProfile(verified.profile);
        setUsername(verified.profile.username);
        setDisplayName(verified.profile.display_name);
        setBio(verified.profile.bio);
        setStatus(ownershipCount === null
          ? "Profile unlocked. Use REFRESH MY GOONS if ownership is not visible yet."
          : `Profile unlocked. Ownership refreshed: ${ownershipCount} Gravity Goon${ownershipCount === 1 ? "" : "s"} found.`);
      } else {
        setStatus(ownershipCount === null
          ? "Wallet verified. Choose your username, then use REFRESH MY GOONS if needed."
          : `Wallet verified. ${ownershipCount} Gravity Goon${ownershipCount === 1 ? "" : "s"} found. Choose your profile username.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallet sign-in was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    try {
      const creatingProfile = !profile;
      const response = await fetchWithTimeout("/api/profile/me", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, displayName, bio }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProfile(data.profile);
      if (creatingProfile) trackMarketingEvent("profile_created", { username: data.profile.username });
      setStatus(`Profile saved. gravitygoons.com/${data.profile.username} is ready.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  }

  async function syncCollection() {
    setBusy(true);
    try {
      const response = await fetchWithTimeout("/api/profile/sync", { method: "POST" }, 30_000);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(`Ownership refreshed: ${data.tokenIds.length} Gravity Goon${data.tokenIds.length === 1 ? "" : "s"} found.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to refresh ownership.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-setup-grid">
      <section className="profile-connect-card">
        <span>01 // VERIFY OWNER</span>
        <h2>{authenticated ? "Wallet verified." : "Sign in with your wallet."}</h2>
        <p>Gravity Goons uses a short wallet signature for profile access. It creates no transaction, costs no gas, and is checked again before any owner-only movie action.</p>
        {!authenticated && <button className="button primary" onClick={signIn} disabled={busy || Boolean(account && !preparedChallengeReady)}>{busy ? "WAITING…" : account && !preparedChallengeReady ? "PREPARING SIGN-IN…" : "CONNECT + SIGN"}</button>}
        {authenticated && <button className="button" onClick={syncCollection} disabled={busy}>{busy ? "SYNCING…" : "REFRESH MY GOONS"}</button>}
      </section>

      <section className="profile-form-card">
        <span>02 // CLAIM YOUR URL</span>
        <label>USERNAME<input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="rocketrob" disabled={!authenticated} /></label>
        <label>DISPLAY NAME<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Rocket Rob" disabled={!authenticated} /></label>
        <label>BIO<textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Tell the Gooniverse who you are…" disabled={!authenticated} maxLength={280} /></label>
        <button className="button primary" onClick={saveProfile} disabled={!authenticated || busy}>{profile ? "UPDATE PROFILE" : "CREATE PROFILE"}</button>
      </section>

      <aside className="profile-system-status">
        <b>SYSTEM STATUS</b><p>{status}</p>
        {profile ? <Link href={`/${profile.username}`}>VIEW SHOWCASE →</Link> : <Link href="/founder">VIEW FOUNDER PROFILE DEMO →</Link>}
      </aside>
    </div>
  );
}
