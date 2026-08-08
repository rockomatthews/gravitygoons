export const matchEscrowWriteAbi = [
  { type: "function", name: "fund", stateMutability: "nonpayable", inputs: [
    { name: "terms", type: "tuple", components: [
      { name: "matchId", type: "bytes32" }, { name: "playerA", type: "address" }, { name: "playerB", type: "address" },
      { name: "tokenA", type: "uint256" }, { name: "tokenB", type: "uint256" }, { name: "stake", type: "uint256" },
      { name: "scheduledStart", type: "uint64" }, { name: "fundingDeadline", type: "uint64" }, { name: "rulesetHash", type: "bytes32" },
      { name: "settlementSigner", type: "address" }, { name: "feeBps", type: "uint16" }, { name: "feeRecipient", type: "address" },
    ] }, { name: "player", type: "address" }, { name: "signature", type: "bytes" },
  ], outputs: [] },
  { type: "function", name: "dispute", stateMutability: "nonpayable", inputs: [{ name: "matchId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "finalize", stateMutability: "nonpayable", inputs: [{ name: "matchId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "refundExpired", stateMutability: "nonpayable", inputs: [{ name: "matchId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "proposeResult", stateMutability: "nonpayable", inputs: [{ name: "matchId", type: "bytes32" }, { name: "winner", type: "address" }, { name: "resultHash", type: "bytes32" }, { name: "deadline", type: "uint64" }, { name: "signature", type: "bytes" }], outputs: [] },
  { type: "function", name: "voidWithSignature", stateMutability: "nonpayable", inputs: [{ name: "matchId", type: "bytes32" }, { name: "reasonHash", type: "bytes32" }, { name: "deadline", type: "uint64" }, { name: "signature", type: "bytes" }], outputs: [] },
] as const;

export const baseUsdcWriteAbi = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const wagerTermsTypes = {
  WagerTerms: [
    { name: "matchId", type: "bytes32" }, { name: "playerA", type: "address" }, { name: "playerB", type: "address" },
    { name: "tokenA", type: "uint256" }, { name: "tokenB", type: "uint256" }, { name: "stake", type: "uint256" },
    { name: "scheduledStart", type: "uint64" }, { name: "fundingDeadline", type: "uint64" }, { name: "rulesetHash", type: "bytes32" },
    { name: "settlementSigner", type: "address" }, { name: "feeBps", type: "uint16" }, { name: "feeRecipient", type: "address" },
  ],
} as const;

export const matchResultTypes = { MatchResult: [
  { name: "matchId", type: "bytes32" }, { name: "termsHash", type: "bytes32" }, { name: "winner", type: "address" },
  { name: "resultHash", type: "bytes32" }, { name: "deadline", type: "uint64" },
] } as const;

export const matchVoidTypes = { MatchVoid: [
  { name: "matchId", type: "bytes32" }, { name: "termsHash", type: "bytes32" },
  { name: "reasonHash", type: "bytes32" }, { name: "deadline", type: "uint64" },
] } as const;
