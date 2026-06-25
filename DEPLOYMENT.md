# Deployment — Filecoin Calibration testnet

**Live and verified end to end on real Calibration with real USDFC.**

| Item | Value |
|---|---|
| Network | Filecoin Calibration (chainId 314159) |
| NumberDuel contract | `0x1c2486f96052aFb0e3c295CD178f925C36076477` |
| USDFC token (official) | `0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0` |
| Explorer | https://calibration.filfox.info/en/address/0x1c2486f96052aFb0e3c295CD178f925C36076477 |

## Proof: a full duel, on-chain

Demo duel #1: setter sealed **7**, guesser guessed **4** (wrong), setter revealed
and took the 2 USDFC pot. Final escrow balance 0 (no funds stuck).

| Step | Tx |
|---|---|
| Deploy | `0x046b647a415c079f836a7699078ff53ce652490562aad576070b5c47b2a7a2e7` |
| createDuel | `0xdcab1adf02d579d705cf6db62d4210f5a7f5074ba8c63c24e4cec068f36d6cb5` |
| joinDuel (guess 4) | `0x12350c3855e6966b5b12ffb915a8907e1d3cc450fb1f9c7b69dc9a3e1e5fe647` |
| reveal (7) → payout | `0xef303bf0a5e6da371ce66abdc217a5e1e799607b2f0f5ce29b680ef4c1db69df` |

`getDuel(1)` ends at status `3` (Settled), `revealedNumber = 7`, `winner = setter`.

## Filecoin gotcha worth noting (AI build log material)

`forge script ... --broadcast` failed twice on Calibration: first with
`GasLimit field cannot be less than the cost of storing a message on chain`
(forge under-estimates FEVM gas), then out-of-gas even at a 20x multiplier.
The reliable fix was deploying with an explicit high gas limit:

```bash
cast send --private-key $PRIVATE_KEY --rpc-url $CALIBRATION_RPC --gas-limit 5000000000 \
  --create $(jq -r '.bytecode.object' out/NumberDuel.sol/NumberDuel.json) \
  "constructor(address)" 0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0
```

The frontend is wired to this address via `web/.env` (`VITE_DUEL_ADDRESS`).
