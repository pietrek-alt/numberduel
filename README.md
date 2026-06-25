# 🎲 NumberDuel

**Provably-fair 1v1 number duel, settled in USDFC on Filecoin.**

One player picks a secret number 1–10 and locks a USDFC stake. The number is
sealed on Filecoin before anyone guesses, so it cannot be changed and cannot be
peeked at. A challenger matches the stake and guesses. Crack the number, take the
pot. Miss, and the setter keeps it. Nobody has to trust anybody, because the
commitment is immutable and public.

Built for the **FilecoinTLDR Builder Challenge - Cycle 1**.

**Live on Filecoin Calibration:** contract
[`0x1c2486f96052aFb0e3c295CD178f925C36076477`](https://calibration.filfox.info/en/address/0x1c2486f96052aFb0e3c295CD178f925C36076477).
A full duel has already run on-chain with real USDFC — see [DEPLOYMENT.md](DEPLOYMENT.md).

## How Filecoin is the product, not hidden plumbing

- **USDFC** (Filecoin-native stablecoin) is the stake, the pot, and the payout.
- The secret number is sealed as `keccak256(number, salt)` and stored
  **immutably on Filecoin** (FVM contract state) before the guess. That
  immutability is the anti-cheat mechanism. Without it, the game is broken.

The fairness is the gameplay. Filecoin is not a backend file store here.

## The main mechanic

1. Setter commits a sealed number + escrows USDFC.
2. Setter shares a duel link.
3. Guesser matches the stake + submits one guess.
4. Setter reveals; the contract verifies the reveal against the sealed
   commitment and pays the winner 2x the stake in USDFC.

A losing setter cannot stall: if they never reveal, the guesser claims the pot
after a timeout. If nobody joins, the setter reclaims their stake.

## Stack

- **Contract:** `contracts/src/NumberDuel.sol` (Solidity, Foundry). 9 passing tests.
- **Network:** Filecoin Calibration testnet (chainId 314159).
- **Token:** USDFC `0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0`.
- **Frontend:** `web/` — Vite + React + wagmi/viem + MetaMask.

## Run it

### 1. Test the contract
```bash
cd contracts
forge test -vv
```

### 2. Deploy to Calibration
Fund a Calibration wallet with tFIL, put its key in `contracts/.env`
(see `.env.example`), then:
```bash
cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url calibration --private-key $PRIVATE_KEY --broadcast
```
Copy the deployed address.

### 3. Run the frontend
```bash
cd web
echo "VITE_DUEL_ADDRESS=<deployed address>" > .env
npm install
npm run dev
```
Open the printed URL, connect MetaMask on Calibration, and duel. Both players
need test USDFC to stake.

## Faucets

- tFIL (gas): Filecoin Calibration faucet.
- Test USDFC: Secured Finance testnet app.

See `DESIGN.md` for the full design rationale and judging alignment.
