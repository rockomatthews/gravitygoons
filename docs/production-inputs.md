# Gravity Goons production input checklist

Never paste a recovery phrase, private key, Filebase token, QuickNode URL, or
deployer key into chat. Public wallet addresses and the final Safe address are
safe to share.

## 1. Prepare three Safe owner addresses

Use three distinct Base-compatible EVM addresses with independent recovery
paths. The recommended split is:

1. Rob's hardware-backed owner wallet.
2. A second hardware wallet stored separately.
3. A recovery signer on a separate device and seed backup.

Do not use the Base App recovery phrase as an input anywhere. Send Codex only
the three public `0x...` addresses.

## 2. Create the production Safe on Base

1. Open `https://app.safe.global/` directly and verify the hostname.
2. Connect owner 1 and select **Base** as the network.
3. Choose **Create new Safe**.
4. Name it `Gravity Goons Production`.
5. Add the three public owner addresses and label them clearly.
6. Set **Required confirmations** to **2 of 3**.
7. Review the network, all three addresses, and the threshold twice.
8. Create/activate the Safe and approve the Base gas transaction.
9. Copy the resulting Safe public address.
10. Have owners 2 and 3 connect to Safe independently and confirm that the Safe
    appears with the same owner list and `2/3` threshold.

Send Codex the three public owner addresses and Safe public address. Do not send
signatures or secrets.

## 3. Pin the immutable release CIDs in Filebase

The CIDs must remain exactly:

- Images: `bafybeignb4b2xm55obk2x66vyrvmg62pgu7gutoopb4xdt2f43kgjrhzrq`
- Metadata: `bafybeiaz3ncdswnf7nfauqzyd7n2frzmk36ovtmvzldp2sz4vwwi2mtzqe`

In Filebase:

1. Create an **IPFS** bucket named `gravity-goons-production`.
2. Open **Access Keys**.
3. Under the IPFS API section, choose that bucket and generate a bucket-scoped
   secret access token.
4. Store the token in a password manager. Do not paste it into chat.
5. Use Filebase's **Search and Pin / Repin by CID** interface to pin each CID,
   naming them `gravity-goons-images` and `gravity-goons-metadata`.
6. Wait until both records show **Pinned**, not merely **Queued** or **Pinning**.
7. Send Codex a screenshot showing both CIDs and their `Pinned` status, with any
   token or account secret hidden.

If the console does not expose Search and Pin, connect Filebase to IPFS Desktop
as a remote pinning service using:

- Service URL: `https://api.filebase.io/v1/ipfs`
- Token: the bucket-scoped Filebase token

Then remotely pin the two CIDs. Codex will perform independent gateway and hash
verification after the status is `Pinned`.

## 4. Create the Base Mainnet QuickNode endpoint

1. In QuickNode, choose **Create an Endpoint**.
2. Select blockchain **Base**.
3. Select network **Mainnet** and confirm chain ID `8453`.
4. Copy the **HTTP provider URL**. WSS is optional for launch.
5. Keep the full URL secret because it contains the access token.
6. Save it locally as `BASE_RPC_URL` in `contract/.env`; never use a
   `NEXT_PUBLIC_` variable.
7. Add the same value to Vercel as the server-only Production secret
   `BASE_RPC_URL`.

Codex will first use the endpoint for read-only chain-ID, balance, Safe, and
deployment-readiness checks. A later contract deployment remains a separate,
explicitly reviewed mainnet action.
