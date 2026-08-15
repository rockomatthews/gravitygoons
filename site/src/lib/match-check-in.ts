export type CheckInWagerState = {
  requested: boolean;
  state: string;
};

type SyncWagerState = (matchId: string, wallet: string) => Promise<CheckInWagerState>;

export async function reconcileWagerBeforeCheckIn(
  matchId: string,
  wallet: string,
  syncWagerState: SyncWagerState,
) {
  const wager = await syncWagerState(matchId, wallet);
  if (wager.requested && wager.state !== "locked") {
    throw new Error("Both USDC stakes must be locked before player check-in");
  }
  return wager;
}
