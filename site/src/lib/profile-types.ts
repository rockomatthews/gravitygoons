export type MovePairStatus =
  | "no_movie"
  | "quoted"
  | "paid"
  | "queued"
  | "generating"
  | "owner_review"
  | "approved"
  | "rejected"
  | "rerolling"
  | "failed"
  | "refunding"
  | "refunded"
  | "unpublished";

export type OutcomeStatus = "missing" | "queued" | "generating" | "owner_review" | "approved" | "rejected" | "failed" | "unpublished";

export type ProfileMove = {
  trickId: number;
  name: string;
  difficulty: number;
  unlocked: boolean;
  pairId: string | null;
  pairStatus: MovePairStatus;
  landStatus: OutcomeStatus;
  fallStatus: OutcomeStatus;
  landVideoUrl: string | null;
  landPosterUrl: string | null;
};

export type ProfileGoon = {
  tokenId: number;
  name: string;
  species: string;
  discipline: string;
  rarity: string;
  playStyle: string;
  trickSpecialty: string;
  imageUrl: string;
  moves: ProfileMove[];
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  wallets: string[];
  goons: ProfileGoon[];
  isDemo: boolean;
};

export type StudioOutcome = {
  id: string;
  outcome: "land" | "fall";
  version: number;
  status: OutcomeStatus;
  videoUrl: string | null;
  posterUrl: string | null;
  ownerDecision: "pending" | "approved" | "rejected";
  rerollsRemaining: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StudioMove = ProfileMove & {
  outcomes: StudioOutcome[];
  quotedPriceUsdc: string;
  workflowStartedAt: string | null;
  workflowUpdatedAt: string | null;
};
