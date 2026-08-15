import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, Wallet, ZeroAddress, ZeroHash, keccak256, toUtf8Bytes } from "ethers";

const root = path.resolve(import.meta.dirname, "..");
const artifact = (name) => JSON.parse(fs.readFileSync(path.join(root, "artifacts", `${name}.json`)));

describe("GoonMatchEscrow", function () {
  let chain, provider, owner, settlementSigner, playerA, playerB, outsider, settlementTypedSigner, playerATypedSigner, playerBTypedSigner, usdc, collection, escrow, domain, termsTypes, resultTypes, voidTypes, deployedPaused;

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
    escrow = await new ContractFactory(artifact("GoonMatchEscrow").abi, artifact("GoonMatchEscrow").bytecode, owner).deploy(owner.address, await usdc.getAddress(), await collection.getAddress(), settlementSigner.address, owner.address);
    await escrow.waitForDeployment();
    deployedPaused = await escrow.paused();
    await (await escrow.unpause()).wait();
    await Promise.all([
      (await collection.mint(playerA.address, 34)).wait(), (await collection.mint(playerB.address, 35)).wait(),
      (await usdc.mint(playerA.address, 100_000_000)).wait(), (await usdc.mint(playerB.address, 100_000_000)).wait(),
    ]);
    await Promise.all([(await usdc.connect(playerA).approve(await escrow.getAddress(), 100_000_000)).wait(), (await usdc.connect(playerB).approve(await escrow.getAddress(), 100_000_000)).wait()]);
    domain = { name: "Gravity Goons Match Escrow", version: "1", chainId: 8453, verifyingContract: await escrow.getAddress() };
    termsTypes = { WagerTerms: [
      { name: "matchId", type: "bytes32" }, { name: "playerA", type: "address" }, { name: "playerB", type: "address" },
      { name: "tokenA", type: "uint256" }, { name: "tokenB", type: "uint256" }, { name: "stake", type: "uint256" },
      { name: "scheduledStart", type: "uint64" }, { name: "fundingDeadline", type: "uint64" }, { name: "rulesetHash", type: "bytes32" },
      { name: "settlementSigner", type: "address" }, { name: "feeBps", type: "uint16" }, { name: "feeRecipient", type: "address" },
    ] };
    resultTypes = { MatchResult: [
      { name: "matchId", type: "bytes32" }, { name: "termsHash", type: "bytes32" }, { name: "winner", type: "address" },
      { name: "resultHash", type: "bytes32" }, { name: "deadline", type: "uint64" },
    ] };
    voidTypes = { MatchVoid: [
      { name: "matchId", type: "bytes32" }, { name: "termsHash", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" }, { name: "deadline", type: "uint64" },
    ] };
  });

  afterEach(async function () { await chain.disconnect(); });

  it("deploys paused and requires the Safe owner to activate funding", async function () {
    assert.equal(deployedPaused, true);
    assert.equal(await escrow.paused(), false);
    await assert.rejects(escrow.connect(outsider).pause());
  });

  async function wagerTerms(stake = 5_000_000, feeBps = 0) {
    const block = await provider.getBlock("latest");
    return {
      matchId: keccak256(toUtf8Bytes(`match-${block.timestamp}-${stake}`)), playerA: playerA.address, playerB: playerB.address,
      tokenA: 34n, tokenB: 35n, stake: BigInt(stake), scheduledStart: BigInt(block.timestamp + 3700), fundingDeadline: BigInt(block.timestamp + 600),
      rulesetHash: keccak256(toUtf8Bytes("gravity-goons-pvp-ruleset-v1")), settlementSigner: settlementSigner.address, feeBps, feeRecipient: owner.address,
    };
  }

  async function fundBoth(terms) {
    const [signatureA, signatureB] = await Promise.all([playerATypedSigner.signTypedData(domain, termsTypes, terms), playerBTypedSigner.signTypedData(domain, termsTypes, terms)]);
    await (await escrow.connect(playerA).fund(terms, playerA.address, signatureA)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 2n);
    await (await escrow.connect(playerB).fund(terms, playerB.address, signatureB)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 3n);
  }

  it("locks equal approved stakes and settles only after the dispute window", async function () {
    const terms = await wagerTerms();
    await fundBoth(terms);
    await chain.request({ method: "evm_increaseTime", params: [3800] });
    await chain.request({ method: "evm_mine", params: [] });
    const stored = await escrow.matchOf(terms.matchId);
    const resultHash = keccak256(toUtf8Bytes("authoritative transcript"));
    const result = { matchId: terms.matchId, termsHash: stored.termsHash, winner: playerA.address, resultHash, deadline: terms.scheduledStart + 3600n };
    const signature = await settlementTypedSigner.signTypedData(domain, resultTypes, result);
    await (await escrow.proposeResult(terms.matchId, playerA.address, resultHash, result.deadline, signature)).wait();
    await assert.rejects(escrow.finalize(terms.matchId));
    await chain.request({ method: "evm_increaseTime", params: [86401] });
    await chain.request({ method: "evm_mine", params: [] });
    const before = await usdc.balanceOf(playerA.address);
    await (await escrow.connect(outsider).finalize(terms.matchId)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 5n);
    assert.equal((await usdc.balanceOf(playerA.address)) - before, 10_000_000n);
  });

  it("allows a player dispute and only the Safe owner can resolve it", async function () {
    const terms = await wagerTerms(1_000_000);
    await fundBoth(terms);
    await chain.request({ method: "evm_increaseTime", params: [3800] }); await chain.request({ method: "evm_mine", params: [] });
    const stored = await escrow.matchOf(terms.matchId);
    const resultHash = keccak256(toUtf8Bytes("result"));
    const deadline = terms.scheduledStart + 3600n;
    const signature = await settlementTypedSigner.signTypedData(domain, resultTypes, { matchId: terms.matchId, termsHash: stored.termsHash, winner: playerA.address, resultHash, deadline });
    await (await escrow.proposeResult(terms.matchId, playerA.address, resultHash, deadline, signature)).wait();
    await (await escrow.connect(playerB).dispute(terms.matchId)).wait();
    await assert.rejects(escrow.connect(outsider).resolveDispute(terms.matchId, playerA.address, true));
    await (await escrow.resolveDispute(terms.matchId, ZeroAddress, true)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 7n);
    assert.equal(await usdc.balanceOf(await escrow.getAddress()), 0n);
  });

  it("refunds a verified no-show without requiring a Safe transaction", async function () {
    const terms = await wagerTerms(5_000_000);
    await fundBoth(terms);
    await chain.request({ method: "evm_increaseTime", params: [3800] });
    await chain.request({ method: "evm_mine", params: [] });
    const stored = await escrow.matchOf(terms.matchId);
    const reasonHash = keccak256(toUtf8Bytes("gravity-goons:no-show:v1"));
    const deadline = terms.scheduledStart + 3600n;
    const signature = await settlementTypedSigner.signTypedData(domain, voidTypes, {
      matchId: terms.matchId, termsHash: stored.termsHash, reasonHash, deadline,
    });
    await assert.rejects(escrow.voidWithSignature(terms.matchId, keccak256(toUtf8Bytes("different reason")), deadline, signature));
    const [beforeA, beforeB] = await Promise.all([usdc.balanceOf(playerA.address), usdc.balanceOf(playerB.address)]);
    await (await escrow.connect(outsider).voidWithSignature(terms.matchId, reasonHash, deadline, signature)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 7n);
    assert.equal((await usdc.balanceOf(playerA.address)) - beforeA, 5_000_000n);
    assert.equal((await usdc.balanceOf(playerB.address)) - beforeB, 5_000_000n);
  });

  it("caps the Safe-controlled house fee at 2.5 percent", async function () {
    await assert.rejects(escrow.setFeeConfiguration(owner.address, 251));
    await (await escrow.setFeeConfiguration(owner.address, 250)).wait();
    assert.equal(await escrow.houseFeeBps(), 250n);
  });

  it("accounts exactly for the maximum fee and never charges it on a refund", async function () {
    await (await escrow.setFeeConfiguration(owner.address, 250)).wait();
    const terms = await wagerTerms(25_000_000, 250);
    await fundBoth(terms);
    await chain.request({ method: "evm_increaseTime", params: [3800] }); await chain.request({ method: "evm_mine", params: [] });
    const stored = await escrow.matchOf(terms.matchId);
    const resultHash = keccak256(toUtf8Bytes("fee transcript"));
    const deadline = terms.scheduledStart + 3600n;
    const signature = await settlementTypedSigner.signTypedData(domain, resultTypes, { matchId: terms.matchId, termsHash: stored.termsHash, winner: playerB.address, resultHash, deadline });
    await (await escrow.proposeResult(terms.matchId, playerB.address, resultHash, deadline, signature)).wait();
    await chain.request({ method: "evm_increaseTime", params: [86401] }); await chain.request({ method: "evm_mine", params: [] });
    const winnerBefore = await usdc.balanceOf(playerB.address);
    const feeBefore = await usdc.balanceOf(owner.address);
    await (await escrow.finalize(terms.matchId)).wait();
    assert.equal((await usdc.balanceOf(playerB.address)) - winnerBefore, 48_750_000n);
    assert.equal((await usdc.balanceOf(owner.address)) - feeBefore, 1_250_000n);

    const refundTerms = await wagerTerms(1_000_000, 250);
    const signatureA = await playerATypedSigner.signTypedData(domain, termsTypes, refundTerms);
    const balanceBefore = await usdc.balanceOf(playerA.address);
    await (await escrow.connect(playerA).fund(refundTerms, playerA.address, signatureA)).wait();
    await chain.request({ method: "evm_increaseTime", params: [601] }); await chain.request({ method: "evm_mine", params: [] });
    await (await escrow.refundExpired(refundTerms.matchId)).wait();
    assert.equal(await usdc.balanceOf(playerA.address), balanceBefore);
  });

  it("rejects replayed funding and result signatures for altered outcomes", async function () {
    const terms = await wagerTerms(10_000_000);
    const signatureA = await playerATypedSigner.signTypedData(domain, termsTypes, terms);
    await assert.rejects(escrow.connect(outsider).fund(terms, playerA.address, signatureA));
    await (await escrow.connect(playerA).fund(terms, playerA.address, signatureA)).wait();
    await assert.rejects(async () => (await escrow.connect(playerA).fund(terms, playerA.address, signatureA)).wait());
    const signatureB = await playerBTypedSigner.signTypedData(domain, termsTypes, terms);
    await (await escrow.connect(playerB).fund(terms, playerB.address, signatureB)).wait();
    await chain.request({ method: "evm_increaseTime", params: [3800] }); await chain.request({ method: "evm_mine", params: [] });
    const stored = await escrow.matchOf(terms.matchId);
    const resultHash = keccak256(toUtf8Bytes("signed result"));
    const deadline = terms.scheduledStart + 3600n;
    const signature = await settlementTypedSigner.signTypedData(domain, resultTypes, { matchId: terms.matchId, termsHash: stored.termsHash, winner: playerA.address, resultHash, deadline });
    await assert.rejects(escrow.proposeResult(terms.matchId, playerB.address, resultHash, deadline, signature));
    await assert.rejects(escrow.proposeResult(terms.matchId, playerA.address, ZeroHash, deadline, signature));
    await (await escrow.proposeResult(terms.matchId, playerA.address, resultHash, deadline, signature)).wait();
    await assert.rejects(async () => (await escrow.proposeResult(terms.matchId, playerA.address, resultHash, deadline, signature)).wait());
  });

  it("enforces same-discipline ownership and Safe-only emergency controls", async function () {
    await (await collection.setDiscipline(35, 1)).wait();
    const terms = await wagerTerms();
    const signatureA = await playerATypedSigner.signTypedData(domain, termsTypes, terms);
    await assert.rejects(escrow.connect(playerA).fund(terms, playerA.address, signatureA));
    await assert.rejects(escrow.connect(outsider).pause());
    await (await escrow.pause()).wait();
    await assert.rejects(escrow.connect(playerA).fund(terms, playerA.address, signatureA));
    await (await escrow.unpause()).wait();
  });

  it("rejects unsupported stake tiers and signatures for a different player", async function () {
    const badTier = await wagerTerms(2_000_000);
    const signature = await playerATypedSigner.signTypedData(domain, termsTypes, badTier);
    await assert.rejects(escrow.connect(playerA).fund(badTier, playerA.address, signature));
    const terms = await wagerTerms();
    await assert.rejects(escrow.connect(playerB).fund(terms, playerB.address, await playerATypedSigner.signTypedData(domain, termsTypes, terms)));
  });
});
