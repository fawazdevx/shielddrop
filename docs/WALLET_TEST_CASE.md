# Wallet Test Case

Use two Sepolia wallets:

- Creator wallet: the wallet that deploys/contracts and stages the distribution.
- Recipient wallet: a second wallet that appears in the CSV.

## Preflight

1. Add Sepolia ETH to both wallets.
2. Deploy the proxy factory and set `VITE_SHIELDDROP_FACTORY_ADDRESS` to the proxy address.
3. Set `VITE_WALLETCONNECT_PROJECT_ID` from WalletConnect Cloud.
4. Run the frontend and connect with RainbowKit.

## Creator Flow

1. Open the app and click `Launch app`.
2. Connect the creator wallet on Sepolia.
3. Go to `Registry` and select `cUSDTMock`.
4. Go to `Command`.
5. Replace the first CSV row wallet with your recipient wallet:

```csv
wallet,label,amount
YOUR_RECIPIENT_WALLET,Test recipient,25
YOUR_CREATOR_WALLET,Creator control row,10
```

6. Click `Validate CSV`.
7. Confirm the recipient table shows two ready rows and zero invalid rows.
8. Click `Encrypt batch`.
9. Confirm handles appear and allocation amounts are hidden until decrypted.
10. Click `Stage privately`.
11. Confirm the app shows claim packets and a transaction/batch id.

## Recipient Flow

1. Disconnect the creator wallet.
2. Connect the recipient wallet.
3. Go to `Claim Desk`.
4. Select `Test recipient`.
5. Click `Decrypt`.
6. Confirm only the selected recipient allocation is revealed.
7. Click `Claim`.
8. Confirm the row status changes to `claimed` and campaign progress increases.

## Negative Checks

1. Connect a wallet that is not in the CSV.
2. Confirm it cannot verify/decrypt a recipient allocation in the intended live flow.
3. Put a duplicate address in the CSV and click `Validate CSV`.
4. Confirm the importer flags the duplicate row.
5. Export the audit report and confirm it does not expose the full private recipient list or plaintext amounts.

## Demo Recording Proof

Capture these screens for the 3-minute pitch:

- RainbowKit connection on Sepolia.
- Registry token selection.
- CSV validation.
- Encrypted handles after `Encrypt batch`.
- Claim packets after `Stage privately`.
- Recipient-only decrypt and claim.
- Sepolia transaction link for the deployed proxy factory or TokenOps airdrop.
