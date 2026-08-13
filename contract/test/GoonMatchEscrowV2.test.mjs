import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, Wallet, keccak256, toUtf8Bytes } from "ethers";

const root = path.resolve(import.meta.dirname, "..");
const artifact = (name) => JSON.parse(fs.readFileSync(path.join(root, "artifacts", `${name}.json`)));

describe("GoonMatchEscrowV2", function () {
  let chain, provider, owner, settlementSigner, playerA, playerB, outsider;
  let settlementTypedSigner, playerATypedSigner, playerBTypedSigner, usdc, collection, escrow, domain;
  const termsTypes = { WagerTerms: [
    { name: "matchId", type: "bytes32" }, { name: "playerA", type: "address" }, { name: "playerB", type: "address" },
    { name: "tokenA", type: "uint256" }, { name: "tokenB", type: "uint256" }, { name: "stake", type: "uint256" },
    { name: "scheduledStart", type: "uint64" }, { name: "fundingDeadline", type: "uint64" }, { name: "rulesetHash", type: "bytes32" },
    { name: "settlementSigner", type: "address" }, { name: "feeBps", type: "uint16" }, { name: "feeRecipient", type: "address" },
  ] };
  const resultTypes = { MatchResult: [
    { name: "matchId", type: "bytes32" }, { name: "termsHash", type: "bytes32" }, { name: "winner", type: "address" },
    { name: "resultHash", type: "bytes32" }, { name: "deadline", type: "uint64" },
  ] };

  beforeEach(async function () {
    chain = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 7 }, chain: { chainId: 8453 } });
    provider = new BrowserProvider(chain);
    [owner, settlementSigner, playerA, playerB, outsider] = await Promise.all([0, 1, 2, 3, 4].map((index) => provider.getSigner(index)));
    const accounts = chain.getInitialAccounts();
    settlementTypedSigner = new Wallet(accounts[settlementSigner.address.toLowerCase()].secretKey);
    playerATypedSigner = new Wallet(accounts[playerA.address.toLowerCase()].secretKey);
    playerBTypedSigner = new Wallet(accounts[playerB.address.toLowerCase()].secretKey);
    usdc = await new ContractFactory(artifact("MockUSDC").abi, artifact("MockUSDC").bytecode, owner).deploy();
    collection = await new ContractFactory(artifact("MockGoonCollection").abi, artifact("MockGoonCollection").bytecode, owner).deploy();
    await Promise.all([usdc.waitForDeployment(), collection.waitForDeployment()]);
    escrow = await new ContractFactory(artifact("GoonMatchEscrowV2").abi, artifact("GoonMatchEscrowV2").bytecode, owner).deploy(owner.address, await usdc.getAddress(), await collection.getAddress(), settlementSigner.address, owner.address);
    await escrow.waitForDeployment();
    await (await escrow.unpause()).wait();
    await Promise.all([
      (await collection.mint(playerA.address, 34)).wait(), (await collection.mint(playerB.address, 35)).wait(),
      (await usdc.mint(playerA.address, 100_000_000)).wait(), (await usdc.mint(playerB.address, 100_000_000)).wait(),
    ]);
    await Promise.all([
      (await usdc.connect(playerA).approve(await escrow.getAddress(), 100_000_000)).wait(),
      (await usdc.connect(playerB).approve(await escrow.getAddress(), 100_000_000)).wait(),
    ]);
    domain = { name: "Gravity Goons Match Escrow", version: "1", chainId: 8453, verifyingContract: await escrow.getAddress() };
  });

  afterEach(async function () { await chain.disconnect(); });

  async function terms(stake = 1_000_000, feeBps = 0) {
    const block = await provider.getBlock("latest");
    return {
      matchId: keccak256(toUtf8Bytes(`v2-${block.timestamp}-${stake}-${feeBps}`)), playerA: playerA.address, playerB: playerB.address,
      tokenA: 34n, tokenB: 35n, stake: BigInt(stake), scheduledStart: BigInt(block.timestamp + 3700), fundingDeadline: BigInt(block.timestamp + 600),
      rulesetHash: keccak256(toUtf8Bytes("gravity-goons-grit-ruleset-v2")), settlementSigner: settlementSigner.address, feeBps, feeRecipient: owner.address,
    };
  }

  async function fundBoth(wager) {
    const [signatureA, signatureB] = await Promise.all([
      playerATypedSigner.signTypedData(domain, termsTypes, wager), playerBTypedSigner.signTypedData(domain, termsTypes, wager),
    ]);
    await (await escrow.connect(playerA).fund(wager, playerA.address, signatureA)).wait();
    await (await escrow.connect(playerB).fund(wager, playerB.address, signatureB)).wait();
  }

  async function propose(wager, winner) {
    await chain.request({ method: "evm_increaseTime", params: [3800] });
    await chain.request({ method: "evm_mine", params: [] });
    const stored = await escrow.matchOf(wager.matchId);
    const resultHash = keccak256(toUtf8Bytes("v2 authoritative transcript"));
    const deadline = wager.scheduledStart + 3600n;
    const signature = await settlementTypedSigner.signTypedData(domain, resultTypes, { matchId: wager.matchId, termsHash: stored.termsHash, winner, resultHash, deadline });
    await (await escrow.proposeResult(wager.matchId, winner, resultHash, deadline, signature)).wait();
  }

  it("deploys with the exact ten-minute correction window", async function () {
    assert.equal(await escrow.DISPUTE_WINDOW(), 600n);
    assert.equal(await escrow.MAX_HOUSE_FEE_BPS(), 250n);
  });

  it("cannot finalize at ten minutes and can finalize immediately after", async function () {
    const wager = await terms();
    await fundBoth(wager);
    await propose(wager, playerA.address);
    await chain.request({ method: "evm_increaseTime", params: [600] });
    await chain.request({ method: "evm_mine", params: [] });
    await assert.rejects(escrow.connect(outsider).finalize(wager.matchId));
    await chain.request({ method: "evm_increaseTime", params: [1] });
    await chain.request({ method: "evm_mine", params: [] });
    const before = await usdc.balanceOf(playerA.address);
    await (await escrow.connect(outsider).finalize(wager.matchId, { gasLimit: 500_000 })).wait();
    assert.equal((await usdc.balanceOf(playerA.address)) - before, 2_000_000n);
  });

  it("keeps disputes player-only and resolution Safe-only", async function () {
    const wager = await terms();
    await fundBoth(wager);
    await propose(wager, playerA.address);
    await assert.rejects(escrow.connect(outsider).dispute(wager.matchId));
    await (await escrow.connect(playerB).dispute(wager.matchId)).wait();
    await assert.rejects(escrow.connect(outsider).resolveDispute(wager.matchId, playerA.address, true));
    await (await escrow.resolveDispute(wager.matchId, playerA.address, true)).wait();
    assert.equal(await usdc.balanceOf(await escrow.getAddress()), 0n);
  });

  it("settles the exact disclosed fee and rejects an altered fee", async function () {
    await (await escrow.setFeeConfiguration(owner.address, 200)).wait();
    const altered = await terms(5_000_000, 0);
    const alteredSignature = await playerATypedSigner.signTypedData(domain, termsTypes, altered);
    await assert.rejects(escrow.connect(playerA).fund(altered, playerA.address, alteredSignature));
    const wager = await terms(5_000_000, 200);
    await fundBoth(wager);
    await propose(wager, playerB.address);
    await chain.request({ method: "evm_increaseTime", params: [601] });
    await chain.request({ method: "evm_mine", params: [] });
    const winnerBefore = await usdc.balanceOf(playerB.address);
    const feeBefore = await usdc.balanceOf(owner.address);
    await (await escrow.finalize(wager.matchId)).wait();
    assert.equal((await usdc.balanceOf(playerB.address)) - winnerBefore, 9_800_000n);
    assert.equal((await usdc.balanceOf(owner.address)) - feeBefore, 200_000n);
  });
});
