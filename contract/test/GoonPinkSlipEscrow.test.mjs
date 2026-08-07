import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, Wallet, ZeroAddress, keccak256, toUtf8Bytes } from "ethers";

const root = path.resolve(import.meta.dirname, "..");
const artifact = (name) => JSON.parse(fs.readFileSync(path.join(root, "artifacts", `${name}.json`)));

describe("GoonPinkSlipEscrow", function () {
  let chain, provider, owner, settlementSigner, playerA, playerB, outsider;
  let settlementTypedSigner, playerATypedSigner, playerBTypedSigner, collection, escrow, domain, termsTypes, resultTypes;

  beforeEach(async function () {
    chain = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 7 }, chain: { chainId: 8453 } });
    provider = new BrowserProvider(chain);
    [owner, settlementSigner, playerA, playerB, outsider] = await Promise.all([0, 1, 2, 3, 4].map((index) => provider.getSigner(index)));
    const accounts = chain.getInitialAccounts();
    settlementTypedSigner = new Wallet(accounts[settlementSigner.address.toLowerCase()].secretKey);
    playerATypedSigner = new Wallet(accounts[playerA.address.toLowerCase()].secretKey);
    playerBTypedSigner = new Wallet(accounts[playerB.address.toLowerCase()].secretKey);
    collection = await new ContractFactory(artifact("MockGoonCollection").abi, artifact("MockGoonCollection").bytecode, owner).deploy();
    await collection.waitForDeployment();
    escrow = await new ContractFactory(artifact("GoonPinkSlipEscrow").abi, artifact("GoonPinkSlipEscrow").bytecode, owner).deploy(owner.address, await collection.getAddress(), settlementSigner.address);
    await escrow.waitForDeployment();
    await Promise.all([
      (await collection.mint(playerA.address, 34)).wait(),
      (await collection.mint(playerB.address, 35)).wait(),
      (await collection.connect(playerA).approve(await escrow.getAddress(), 34)).wait(),
      (await collection.connect(playerB).approve(await escrow.getAddress(), 35)).wait(),
    ]);
    domain = { name: "Gravity Goons Pink Slip Escrow", version: "1", chainId: 8453, verifyingContract: await escrow.getAddress() };
    termsTypes = { PinkSlipTerms: [
      { name: "matchId", type: "bytes32" }, { name: "playerA", type: "address" }, { name: "playerB", type: "address" },
      { name: "tokenA", type: "uint256" }, { name: "tokenB", type: "uint256" }, { name: "disciplineHash", type: "bytes32" },
      { name: "scheduledStart", type: "uint64" }, { name: "depositDeadline", type: "uint64" }, { name: "rulesetHash", type: "bytes32" },
      { name: "settlementSigner", type: "address" },
    ] };
    resultTypes = { PinkSlipResult: [
      { name: "matchId", type: "bytes32" }, { name: "termsHash", type: "bytes32" }, { name: "winner", type: "address" },
      { name: "resultHash", type: "bytes32" }, { name: "deadline", type: "uint64" },
    ] };
  });

  afterEach(async function () { await chain.disconnect(); });

  async function pinkSlipTerms(label = "primary") {
    const block = await provider.getBlock("latest");
    return {
      matchId: keccak256(toUtf8Bytes(`pink-slip-${label}-${block.timestamp}`)),
      playerA: playerA.address, playerB: playerB.address, tokenA: 34n, tokenB: 35n,
      disciplineHash: keccak256(toUtf8Bytes("skateboarding")), scheduledStart: BigInt(block.timestamp + 3700),
      depositDeadline: BigInt(block.timestamp + 600), rulesetHash: keccak256(toUtf8Bytes("gravity-goons-pvp-ruleset-v2-live-setter-cooldowns")),
      settlementSigner: settlementSigner.address,
    };
  }

  async function depositBoth(terms) {
    const [signatureA, signatureB] = await Promise.all([
      playerATypedSigner.signTypedData(domain, termsTypes, terms),
      playerBTypedSigner.signTypedData(domain, termsTypes, terms),
    ]);
    await (await escrow.connect(outsider).deposit(terms, playerA.address, signatureA)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 1n);
    await (await escrow.connect(outsider).deposit(terms, playerB.address, signatureB)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 2n);
  }

  it("locks both Goons and transfers both to the winner after the dispute window", async function () {
    const terms = await pinkSlipTerms();
    await depositBoth(terms);
    assert.equal(await collection.ownerOf(34), await escrow.getAddress());
    assert.equal(await collection.ownerOf(35), await escrow.getAddress());
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
    await (await escrow.connect(outsider).finalize(terms.matchId)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 4n);
    assert.equal(await collection.ownerOf(34), playerA.address);
    assert.equal(await collection.ownerOf(35), playerA.address);
  });

  it("returns a lone deposit after the funding deadline", async function () {
    const terms = await pinkSlipTerms("partial");
    const signatureA = await playerATypedSigner.signTypedData(domain, termsTypes, terms);
    await (await escrow.deposit(terms, playerA.address, signatureA)).wait();
    await chain.request({ method: "evm_increaseTime", params: [601] });
    await chain.request({ method: "evm_mine", params: [] });
    await (await escrow.connect(outsider).refundExpired(terms.matchId)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 5n);
    assert.equal(await collection.ownerOf(34), playerA.address);
  });

  it("allows either player to dispute and only the Safe owner to resolve", async function () {
    const terms = await pinkSlipTerms("dispute");
    await depositBoth(terms);
    await chain.request({ method: "evm_increaseTime", params: [3800] });
    await chain.request({ method: "evm_mine", params: [] });
    const stored = await escrow.matchOf(terms.matchId);
    const resultHash = keccak256(toUtf8Bytes("disputed transcript"));
    const deadline = terms.scheduledStart + 3600n;
    const signature = await settlementTypedSigner.signTypedData(domain, resultTypes, { matchId: terms.matchId, termsHash: stored.termsHash, winner: playerA.address, resultHash, deadline });
    await (await escrow.proposeResult(terms.matchId, playerA.address, resultHash, deadline, signature)).wait();
    await (await escrow.connect(playerB).dispute(terms.matchId)).wait();
    await assert.rejects(escrow.connect(outsider).resolveDispute(terms.matchId, playerA.address, false));
    await (await escrow.resolveDispute(terms.matchId, ZeroAddress, true)).wait();
    assert.equal((await escrow.matchOf(terms.matchId)).state, 6n);
    assert.equal(await collection.ownerOf(34), playerA.address);
    assert.equal(await collection.ownerOf(35), playerB.address);
  });

  it("rejects an unauthorized signature and unsolicited NFT custody", async function () {
    const terms = await pinkSlipTerms("invalid");
    const wrongSignature = await playerBTypedSigner.signTypedData(domain, termsTypes, terms);
    await assert.rejects(escrow.deposit(terms, playerA.address, wrongSignature));
    await assert.rejects(collection.connect(playerA)["safeTransferFrom(address,address,uint256)"](playerA.address, await escrow.getAddress(), 34));
  });

  it("lets only the Safe pause custody and rotate the settlement signer", async function () {
    await assert.rejects(escrow.connect(outsider).pause());
    await (await escrow.pause()).wait();
    const terms = await pinkSlipTerms("paused");
    const signatureA = await playerATypedSigner.signTypedData(domain, termsTypes, terms);
    await assert.rejects(escrow.deposit(terms, playerA.address, signatureA));
    await (await escrow.unpause()).wait();
    await assert.rejects(escrow.setSettlementSigner(ZeroAddress));
    await (await escrow.setSettlementSigner(outsider.address)).wait();
    assert.equal(await escrow.settlementSigner(), outsider.address);
  });
});
