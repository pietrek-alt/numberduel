# AI build log — NumberDuel

This project was built with Claude Code as the build partner, which is the point
of the FilecoinTLDR Builder Challenge.

## Brainstorm

Ran a structured ideation session (YC office-hours style) to find an idea that was
quirky and fun but not a one-joke toy. 

The idea that survived: a provably-fair 1v1 guessing duel where USDFC is the stake
and Filecoin's immutability is the anti-cheat. Filecoin is part of the gameplay,
not hidden storage.

## Research (grounded, not guessed)

Pulled the real facts from source instead of guessing an API:
- Synapse SDK package + concepts from the `@filoz/synapse-sdk` README.
- USDFC Calibration address `0xb304...cDf0` and chain details (chainId 314159,
  RPC, explorer) straight from the Synapse SDK's `chains.ts` source.

Decision logged: the Synapse storage path (Warm Storage, data sets, payment rails,
PDP) is too heavy for the deadline, so the MVP stores the commitment immutably in
FVM contract state and uses USDFC for stakes. Synapse piece-pinning is a stretch
goal, not a blocker.

## Build

- Contract `NumberDuel.sol`: commit-reveal + USDFC escrow + timeout/refund safety
  valves. Caught and closed an exploit during design (a setter committing an
  out-of-range number to make the game unguessable) by range-checking the reveal.
- 9 Foundry tests covering setter-win, guesser-win, tamper-revert, the
  out-of-range cheat, timeout claim, refunds, and join guards. All passing.
- Frontend: Vite + React + wagmi/viem with the full flow (set, share, guess,
  reveal, settle) and a verify-on-explorer link.

## Honest notes

- Real-money gambling is out of scope; this is testnet USDFC only.
- Tested locally with Foundry; on-chain deploy + live demo recorded separately.
