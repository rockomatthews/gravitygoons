import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, Wallet, parseEther } from "ethers";

const root = path.resolve(import.meta.dirname, "..");
const impactArtifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "GravityGoons.json")));
const registryArtifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "GravityGoonsProgressRegistry.json")));
const disciplineWords = JSON.parse(fs.readFileSync(path.join(root, "config", "discipline-words.json")));

describe("Gravity Goons launch contracts", function () {
  let ganacheProvider;
  let provider;
  let owner;
  let gameSigner;
  let collector;
  let secondCollector;
  let registry;
  let collection;

  beforeEach(async function () {
    ganacheProvider = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 8 } });
    provider = new BrowserProvider(ganacheProvider);
    const accounts = ganacheProvider.getInitialAccounts();
    owner = await provider.getSigner(0);
    collector = await provider.getSigner(2);
    secondCollector = await provider.getSigner(3);
    const gameAccount = await provider.getSigner(1);
    gameSigner = new Wallet(accounts[(await gameAccount.getAddress()).toLowerCase()].secretKey, provider);

    const Registry = new ContractFactory(registryArtifact.abi, registryArtifact.bytecode, owner);
    registry = await Registry.deploy(owner.address, gameSigner.address);
    await registry.waitForDeployment();
    const Collection = new ContractFactory(impactArtifact.abi, impactArtifact.bytecode, owner);
    collection = await Collection.deploy(
      owner.address,
      await registry.getAddress(),
      "https://impact.example/api/nft/v1/",
      disciplineWords,
    );
    await collection.waitForDeployment();
    await (await registry.setCollectionOnce(await collection.getAddress())).wait();
  });

  afterEach(async function () {
    await ganacheProvider.disconnect();
  });

  it("mints exact visible token IDs and returns immediate metadata", async function () {
    assert.equal((await collection.owner()).toLowerCase(), owner.address.toLowerCase());
    await (await collection.setMintOpen(true)).wait();
    await (await collection.connect(collector).mintSelected([17, 812], { value: parseEther("0.006") })).wait();
    assert.equal(await collection.ownerOf(17), collector.address);
    assert.equal(await collection.ownerOf(812), collector.address);
    assert.equal(await collection.tokenURI(17), "https://impact.example/api/nft/v1/0017");
    assert.equal(await collection.isAvailable(17), false);
    assert.equal(await collection.isAvailable(18), true);
    assert.equal(await collection.publicMinted(), 2n);
  });

  it("rejects duplicates, sold IDs, incorrect payment, and wallet overflow", async function () {
    await (await collection.setMintOpen(true)).wait();
    await assert.rejects(collection.connect(collector).mintSelected([4, 4], { value: parseEther("0.006") }));
    await assert.rejects(collection.connect(collector).mintSelected([4], { value: parseEther("0.002") }));
    await (await collection.connect(collector).mintSelected([1, 2, 3, 4, 5], { value: parseEther("0.015") })).wait();
    await assert.rejects(collection.connect(collector).mintSelected([6], { value: parseEther("0.003") }));
    await assert.rejects(collection.connect(secondCollector).mintSelected([1], { value: parseEther("0.003") }));
  });

  it("supports creator-selected reserve pieces and repeatable sale controls", async function () {
    await (await collection.creatorMintSelected(owner.address, [55, 144, 987])).wait();
    assert.equal(await collection.creatorMinted(), 3n);
    assert.equal(await collection.ownerOf(987), owner.address);
    await (await collection.setMintOpen(true)).wait();
    assert.equal(await collection.mintOpen(), true);
    await (await collection.setMintOpen(false)).wait();
    await (await collection.setMintOpen(true)).wait();
    assert.equal(await collection.mintOpen(), true);
  });

  it("settles signed monotonic progress and keeps it attached after transfer", async function () {
    await (await collection.setMintOpen(true)).wait();
    await (await collection.connect(collector).mintSelected([1], { value: parseEther("0.003") })).wait();
    const network = await provider.getNetwork();
    const discipline = Number(await collection.disciplineOf(1));
    const block = await provider.getBlock("latest");
    const claim = {
      tokenId: 1n,
      xp: 120n,
      level: 2,
      trickBitmap: 5n,
      achievementBitmap: 1n,
      catalogVersion: 1,
      discipline,
      nonce: 0,
      deadline: BigInt(block.timestamp + 3600),
    };
    const domain = {
      name: "Gravity Goons Progress",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await registry.getAddress(),
    };
    const types = {
      ProgressClaim: [
        { name: "tokenId", type: "uint256" },
        { name: "xp", type: "uint64" },
        { name: "level", type: "uint32" },
        { name: "trickBitmap", type: "uint64" },
        { name: "achievementBitmap", type: "uint64" },
        { name: "catalogVersion", type: "uint16" },
        { name: "discipline", type: "uint8" },
        { name: "nonce", type: "uint32" },
        { name: "deadline", type: "uint64" },
      ],
    };
    const signature = await gameSigner.signTypedData(domain, types, claim);
    await (await registry.connect(secondCollector).applyProgress(claim, signature)).wait();
    const progress = await registry.progressOf(1);
    assert.equal(progress.xp, 120n);
    assert.equal(progress.level, 2n);
    assert.equal(progress.trickBitmap, 5n);
    assert.equal(progress.nonce, 1n);

    await (await collection.connect(collector).transferFrom(collector.address, secondCollector.address, 1)).wait();
    const afterTransfer = await registry.progressOf(1);
    assert.equal(afterTransfer.xp, 120n);
    assert.equal(await collection.ownerOf(1), secondCollector.address);
    await assert.rejects(registry.applyProgress(claim, signature));
  });

  it("rejects wrong-discipline and decreasing progression", async function () {
    await (await collection.setMintOpen(true)).wait();
    await (await collection.connect(collector).mintSelected([9], { value: parseEther("0.003") })).wait();
    const actual = Number(await collection.disciplineOf(9));
    const block = await provider.getBlock("latest");
    const network = await provider.getNetwork();
    const domain = { name: "Gravity Goons Progress", version: "1", chainId: network.chainId, verifyingContract: await registry.getAddress() };
    const types = { ProgressClaim: [
      { name: "tokenId", type: "uint256" }, { name: "xp", type: "uint64" },
      { name: "level", type: "uint32" }, { name: "trickBitmap", type: "uint64" },
      { name: "achievementBitmap", type: "uint64" }, { name: "catalogVersion", type: "uint16" },
      { name: "discipline", type: "uint8" }, { name: "nonce", type: "uint32" },
      { name: "deadline", type: "uint64" },
    ] };
    const wrong = { tokenId: 9n, xp: 1n, level: 1, trickBitmap: 1n, achievementBitmap: 0n, catalogVersion: 1, discipline: (actual + 1) % 6, nonce: 0, deadline: BigInt(block.timestamp + 3600) };
    const wrongSignature = await gameSigner.signTypedData(domain, types, wrong);
    await assert.rejects(registry.applyProgress(wrong, wrongSignature));
  });
});
