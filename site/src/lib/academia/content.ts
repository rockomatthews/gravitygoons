import "server-only";
import type { AcademiaCourse, AcademiaLesson } from "./types";

type PrivateLesson = AcademiaLesson & { correctAnswers: number[] };
type PrivateCourse = Omit<AcademiaCourse, "lessons"> & { lessons: PrivateLesson[] };

const lesson = (value: PrivateLesson): PrivateLesson => value;

export const ACADEMIA_COURSES: PrivateCourse[] = [
  { id: "crypto-ground-school", number: 1, title: "Crypto Ground School", subtitle: "Understand wallets, networks, transactions, and ownership before spending anything.", color: "#18f1dc", lessons: [
    lesson({ id: "wallet-not-account", courseId: "crypto-ground-school", number: 1, title: "Your Wallet Is the Key", summary: "Learn what a wallet controls and what it never needs to reveal.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "WALLET BASICS", title: "An address receives. A key authorizes.", body: "Your public address can be shared to receive assets. Your private key or recovery phrase controls the wallet and must stay private." },
      { eyebrow: "SIGNATURES", title: "Signing is not always spending.", body: "A login signature proves wallet control without moving funds. A transaction signature can change blockchain state, so read the wallet request before approving." },
      { eyebrow: "RED ALERT", title: "Gravity Goons never needs your recovery phrase.", body: "Anyone asking for it can take every asset controlled by that wallet.", warning: "Never paste a recovery phrase or private key into Academia, chat, support, or a website." },
    ], questions: [
      { prompt: "Which value is safe to share when receiving an NFT?", options: ["Public wallet address", "Private key", "Recovery phrase"] },
      { prompt: "What should you do before approving a transaction?", options: ["Review the network, action, value, and recipient", "Assume every popup is safe", "Send your recovery phrase to support"] },
    ], correctAnswers: [0, 0] }),
    lesson({ id: "blockchain-receipts", courseId: "crypto-ground-school", number: 2, title: "Blockchain Receipts", summary: "Read confirmations, token IDs, and explorers without trusting screenshots.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "TRANSACTIONS", title: "A transaction hash is a receipt number.", body: "Explorers use it to show the sending wallet, receiving contract, network, status, and emitted events." },
      { eyebrow: "NFT IDENTITY", title: "Contract plus token ID identifies a Goon.", body: "A picture alone is not proof. The collection contract, Base network, and exact token ID distinguish the real asset from copies." },
      { eyebrow: "FINALITY", title: "Blockchain actions are normally irreversible.", body: "Verify the destination and amount before signing. A confirmed transfer usually cannot be reversed by support." },
    ], questions: [
      { prompt: "What uniquely identifies an NFT?", options: ["Its image filename", "Its contract address and token ID on a network", "Its owner nickname"] },
      { prompt: "What can a transaction hash help verify?", options: ["The onchain status and participants", "A recovery phrase", "Future market value"] },
    ], correctAnswers: [1, 0] }),
    lesson({ id: "crypto-is-risk", courseId: "crypto-ground-school", number: 3, title: "Risk Before Hype", summary: "Separate utility and entertainment from promises of profit.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "NO GUARANTEES", title: "NFT prices can rise, fall, or disappear.", body: "Buy only if the art, access, game, and community are worth the cost to you. Never treat projected resale value as guaranteed." },
      { eyebrow: "SCAM PATTERNS", title: "Urgency is a warning sign.", body: "Fake support, surprise airdrops, copied collection pages, and pressure to act immediately are common attack patterns." },
      { eyebrow: "SAFE HABIT", title: "Slow down before every signature.", body: "Confirm the URL, connected wallet, selected network, contract, amount, and requested permission." },
    ], questions: [
      { prompt: "Which is the safest reason to buy an NFT?", options: ["Guaranteed profit", "You value its current art and utility and accept the risk", "A stranger promised a price increase"] },
      { prompt: "What does artificial urgency often indicate?", options: ["Guaranteed authenticity", "A possible scam or manipulation attempt", "Lower gas fees"] },
    ], correctAnswers: [1, 1] }),
  ] },
  { id: "base-flight-school", number: 2, title: "Base Flight School", subtitle: "Use the correct network, understand gas, and move assets without guessing.", color: "#4d7dff", lessons: [
    lesson({ id: "meet-base", courseId: "base-flight-school", number: 1, title: "Meet Base", summary: "Learn the network Gravity Goons lives on.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "NETWORK", title: "Gravity Goons lives on Base Mainnet.", body: "Base Mainnet uses chain ID 8453 and ETH as its native gas currency. The same wallet address can exist on several networks, but balances and NFTs do not automatically move between them." },
      { eyebrow: "WALLET CHECK", title: "Select Base before interacting.", body: "Coinbase Wallet supports Base directly. Other EVM wallets can add Base and should display Base as the active network before a purchase." },
      { eyebrow: "VERIFY", title: "Use an explorer after a transaction.", body: "A Base explorer can confirm whether the transaction succeeded and which token moved.", action: { label: "READ BASE NETWORK DOCS", href: "https://docs.base.org/base-chain/quickstart/connecting-to-base" } },
    ], questions: [
      { prompt: "What is the Base Mainnet chain ID?", options: ["1", "8453", "84532"] },
      { prompt: "Which currency is used for standard Base gas?", options: ["ETH", "GRIT", "A Gravity Goons token"] },
    ], correctAnswers: [1, 0] }),
    lesson({ id: "gas-and-usdc", courseId: "base-flight-school", number: 2, title: "ETH, USDC, and Gas", summary: "Know what pays for a Goon and what pays the network.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "GAS", title: "Gas pays the network to process state changes.", body: "A purchase can require both the listed asset and a small amount of Base ETH for gas. Wallet estimates can change with network conditions." },
      { eyebrow: "ASSETS", title: "ETH and USDC are different assets.", body: "A listing specifies its payment currency. Gravity Goons match stakes may use USDC, while gas is generally paid in Base ETH." },
      { eyebrow: "BALANCE CHECK", title: "Keep a small gas buffer.", body: "Do not spend the wallet's final fraction of ETH on the listed price if the transaction also requires ETH gas." },
    ], questions: [
      { prompt: "A Goon is listed for USDC. What may still be needed for gas?", options: ["Base ETH", "GRIT", "Another NFT"] },
      { prompt: "Is a gas estimate guaranteed to remain identical?", options: ["Yes", "No, network conditions can change it", "Only for NFTs"] },
    ], correctAnswers: [0, 1] }),
    lesson({ id: "bridges-and-transfers", courseId: "base-flight-school", number: 3, title: "Move Without Losing", summary: "Distinguish transfers, bridges, and network selection.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "TRANSFER", title: "A transfer moves an asset to another address on its network.", body: "Always verify the recipient address. Start with a small test when moving meaningful value to a new destination." },
      { eyebrow: "BRIDGE", title: "A bridge moves value between networks.", body: "Sending an asset on Ethereum does not make it appear on Base. Use a reputable bridge or an exchange withdrawal that explicitly supports Base." },
      { eyebrow: "DEPOSIT WARNING", title: "Confirm both asset and network support.", body: "An exchange deposit address may not support every asset or network. Read its deposit instructions before sending." },
    ], questions: [
      { prompt: "What should an exchange withdrawal explicitly support for a Goon purchase?", options: ["Base network", "Any network with the same address", "Only Bitcoin"] },
      { prompt: "What is a sensible first step with a new destination?", options: ["Send everything immediately", "Use a small test transaction", "Share your private key"] },
    ], correctAnswers: [0, 1] }),
  ] },
  { id: "nft-ownership-lab", number: 3, title: "NFT Ownership Lab", subtitle: "Understand what a Goon contains, what follows it, and how marketplace approvals work.", color: "#f768ff", lessons: [
    lesson({ id: "what-you-own", courseId: "nft-ownership-lab", number: 1, title: "What a Goon Owns", summary: "Connect the onchain token to its persistent game career.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "ONCHAIN", title: "The NFT proves control of an exact athlete.", body: "Every Gravity Goon has a token ID, discipline, fixed five-stat build, visual traits, and rarity." },
      { eyebrow: "CAREER", title: "Progress belongs to the token ID.", body: "GRIT, unlocked tricks, records, materials, equipment, and trophies follow the Goon when ownership changes." },
      { eyebrow: "CONTROL", title: "Only the current Base owner can mutate the career.", body: "Ownership is revalidated before protected game actions. A former owner loses control after transfer." },
    ], questions: [
      { prompt: "What happens to a Goon's GRIT when it transfers?", options: ["It follows the Goon", "It becomes a wallet token", "It is automatically sold"] },
      { prompt: "Who controls career mutations?", options: ["Any prior owner", "The current verified Base owner", "Anyone with the image"] },
    ], correctAnswers: [0, 1] }),
    lesson({ id: "approvals-and-signatures", courseId: "nft-ownership-lab", number: 2, title: "Approvals and Signatures", summary: "Recognize purchase, listing, and transfer permissions.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "SIGNATURE", title: "A signature can create a marketplace order.", body: "Listing a Goon may require an approval transaction and an order signature. Read which NFT and permission are requested." },
      { eyebrow: "PURCHASE", title: "Buying executes a marketplace or mint transaction.", body: "Review the exact Goon, payment currency, price, fee details, and destination wallet before confirmation." },
      { eyebrow: "LIMIT PERMISSION", title: "Avoid unnecessary broad approvals.", body: "Approvals let contracts move assets under defined conditions. Confirm the contract and scope before signing." },
    ], questions: [
      { prompt: "What should a buyer verify in the wallet?", options: ["Exact item, currency, price, contract action, and network", "Only the artwork color", "A support agent's password"] },
      { prompt: "Why should approvals be reviewed?", options: ["They can grant contracts permission over assets", "They change NFT artwork", "They guarantee profit"] },
    ], correctAnswers: [0, 0] }),
    lesson({ id: "authenticity-check", courseId: "nft-ownership-lab", number: 3, title: "Spot the Real Goon", summary: "Verify links and token identity before acting.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "START SAFE", title: "Begin at gravitygoons.com.", body: "Use the official collection interface and the NFT's permanent profile route instead of following unsolicited marketplace links." },
      { eyebrow: "EXACT ID", title: "Inspect the token ID and ownership state.", body: "Every collection card opens an exact NFT profile with its metadata, record, tricks, and current sale state." },
      { eyebrow: "COPY TEST", title: "A copied image is not the NFT.", body: "Verify the Base collection contract and token ID through the site and explorer before spending." },
    ], questions: [
      { prompt: "What is stronger authenticity evidence than an image?", options: ["Base contract plus token ID", "A direct message", "A screenshot"] },
      { prompt: "Where should a buyer begin?", options: ["An unsolicited link", "gravitygoons.com and the exact NFT profile", "A seed phrase form"] },
    ], correctAnswers: [0, 1] }),
  ] },
  { id: "buy-your-goon", number: 4, title: "Buy Your First Goon", subtitle: "A practical walkthrough from collection card to confirmed ownership.", color: "#caff38", lessons: [
    lesson({ id: "prepare-wallet", courseId: "buy-your-goon", number: 1, title: "Prepare the Wallet", summary: "Get onto Base and understand the amount you need before checkout.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "STEP 1", title: "Connect the wallet you want to own the Goon.", body: "The connected Base address will become the NFT owner after a successful purchase or mint." },
      { eyebrow: "STEP 2", title: "Select Base Mainnet and check funding.", body: "Match the card's payment currency and keep enough Base ETH for gas. Never send funds to a person who offers to complete checkout for you." },
      { eyebrow: "STEP 3", title: "Open the official collection.", body: "Browse exact-ID athletes, compare discipline, stats, rarity, specialty, price, and sale status.", action: { label: "OPEN THE GOON COLLECTION", href: "/collection" } },
    ], questions: [
      { prompt: "Which wallet receives the Goon?", options: ["The connected purchasing wallet", "The website developer's wallet", "A random address"] },
      { prompt: "What should remain after budgeting the price?", options: ["Enough Base ETH for estimated gas", "Your recovery phrase in chat", "A guaranteed resale profit"] },
    ], correctAnswers: [0, 0] }),
    lesson({ id: "choose-exact-goon", courseId: "buy-your-goon", number: 2, title: "Choose the Exact Goon", summary: "Use the card and athlete profile deliberately.", durationMinutes: 3, rewardGrit: 1, pages: [
      { eyebrow: "UNMINTED", title: "ADD GOON builds a mint lineup.", body: "When minting is available, ADD GOON selects that exact athlete and opens the price summary. The rest of the card opens its permanent NFT profile." },
      { eyebrow: "LISTED", title: "BUY NOW purchases an owner listing.", body: "A listed Goon displays its currency and price. BUY NOW starts the protected marketplace transaction for that exact token." },
      { eyebrow: "COMPARE", title: "Discipline matters more than collecting everything.", body: "One Goon in one discipline is enough for a full Blackout Circuit campaign. Choose the athlete you actually want to develop." },
    ], questions: [
      { prompt: "What does ADD GOON do?", options: ["Adds an exact unminted athlete to the mint lineup", "Transfers a random NFT", "Shares your wallet key"] },
      { prompt: "How many disciplines are required to play a full Circuit campaign?", options: ["All six", "One", "None, guest rewards are automatic"] },
    ], correctAnswers: [0, 1] }),
    lesson({ id: "review-confirm-verify", courseId: "buy-your-goon", number: 3, title: "Review, Confirm, Verify", summary: "Read the transaction and confirm ownership after it settles.", durationMinutes: 4, rewardGrit: 1, pages: [
      { eyebrow: "REVIEW", title: "Read the wallet confirmation.", body: "Confirm Base, the exact payment amount, estimated gas, and the contract action. Reject it if the details do not match the collection screen." },
      { eyebrow: "CONFIRM", title: "Wait for the transaction receipt.", body: "Do not repeat the purchase merely because confirmation takes time. Check the transaction hash first." },
      { eyebrow: "VERIFY", title: "Refresh your Gravity Goons profile.", body: "After ownership synchronizes, the Goon appears in your wallet identity and its GRIT, career, tricks, and game access become controllable by your wallet.", action: { label: "VIEW YOUR WALLET PROFILE", href: "/profile" } },
    ], questions: [
      { prompt: "A transaction is taking time. What should you do first?", options: ["Submit the same purchase repeatedly", "Check its transaction hash and status", "Share your private key"] },
      { prompt: "Where should a successfully acquired Goon appear?", options: ["In the connected wallet profile after ownership sync", "Only in a screenshot", "In every wallet"] },
    ], correctAnswers: [1, 0] }),
  ] },
];

export function publicAcademiaCourses(): AcademiaCourse[] {
  return ACADEMIA_COURSES.map((course) => ({ ...course, lessons: course.lessons.map(({ correctAnswers, ...publicLesson }) => { void correctAnswers; return publicLesson; }) }));
}

export function privateAcademiaLesson(lessonId: string): PrivateLesson {
  const found = ACADEMIA_COURSES.flatMap((course) => course.lessons).find((candidate) => candidate.id === lessonId);
  if (!found) throw new Error("ACADEMIA_LESSON_NOT_FOUND");
  return found;
}
