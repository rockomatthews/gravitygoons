import { keccak256, stringToHex } from "viem";

export const ACTIVE_RULESET_HASH = keccak256(stringToHex("gravity-goons-pvp-ruleset-v3-token-grit-commitments"));
export const MAX_MATCH_GRIT = 10;
export const MATCH_MODES = ["live_ranked"] as const;
export type MatchMode = typeof MATCH_MODES[number];
export const STAKE_TIERS_MINOR = [1_000_000, 5_000_000, 10_000_000, 25_000_000] as const;
export const MAX_HOUSE_FEE_BPS = 250;
