# Submission — NumberDuel

FilecoinTLDR Builder Challenge - Cycle 1. Fill the two `<…>` links after hosting
the frontend and posting on X.

## Title
NumberDuel

## Short description
A provably-fair 1v1 number duel settled in USDFC on Filecoin. One player seals a
secret number 1-10 and stakes USDFC. A challenger matches the stake and guesses.
Crack the number, take the pot. The number is sealed on Filecoin before anyone
guesses, so nobody can cheat.

## Links
- Live demo: https://pietrek-alt.github.io/numberduel/  (live once Pages is enabled)
- Repo: https://github.com/pietrek-alt/numberduel
- Contract (Filfox): https://calibration.filfox.info/en/address/0x1c2486f96052aFb0e3c295CD178f925C36076477
- X post: `<your-x-post-url>`

## Main mechanic (and how Filecoin is in the product, not hidden storage)
1. Setter picks a secret number and stakes USDFC. The number is sealed as
   `keccak256(number, salt)` and stored immutably on Filecoin before any guess.
2. Setter shares a duel link.
3. Challenger matches the stake and submits one guess.
4. Setter reveals; the contract checks the reveal against the sealed commitment
   and pays the winner 2x the stake in USDFC.

Filecoin does two jobs you can see in the gameplay: **USDFC** is the stake, pot,
and payout, and the **immutable commitment** is the anti-cheat. Remove either and
the game breaks. It is not a file-storage app with Filecoin bolted on.

## How it uses the Filecoin stack
- **USDFC** (Filecoin-native stablecoin): the money in the game. Official
  Calibration token `0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0`.
- **Immutable commitment on Filecoin (FVM):** the sealed number lives in contract
  state on Filecoin, so it cannot be changed after a guess and stays hidden until
  reveal. That immutability is what makes the duel trustless.

## Working demo evidence
Deployed and exercised end to end on Calibration with real USDFC. A full duel
(seal 7 → guess 4 → reveal → setter took the 2 USDFC pot, escrow ended at 0) is
on-chain. Tx hashes in DEPLOYMENT.md. Contract: `0x1c2486f96052aFb0e3c295CD178f925C36076477`.

## AI build log (short)
Built with Claude Code. Highlights:
- Used an office-hours-style ideation pass with one design goal: make Filecoin a
  visible game mechanic rather than hidden storage, and build something
  interactive with real stakes instead of another upload-a-file app.
- Grounded the Synapse SDK + USDFC facts from source instead of guessing.
- Caught and closed an exploit during design (a setter committing an
  out-of-range number to make the game unwinnable) by range-checking the reveal.
- 9 Foundry tests, all passing.
- Hit a real Filecoin gas quirk: `forge --broadcast` underestimates FEVM gas;
  fixed by deploying with `cast --create` and an explicit high gas limit.
Full version in AI_BUILD_LOG.md.

---

## X post draft (tag @Filecoin and @FilecoinTLDR)

> Built NumberDuel for the @FilecoinTLDR Builder Challenge 🎲
>
> A provably-fair 1v1 guessing duel. Pick a secret number, stake USDFC. Your
> number is sealed on @Filecoin before your opponent guesses, so nobody can
> cheat. Crack it, take the pot.
>
> Live on Calibration 👇 https://pietrek-alt.github.io/numberduel/
> Built with Claude Code.
> #Filecoin #USDFC

Attach: a short screen recording of the set → share → guess → reveal → payout
flow (or at minimum a screenshot of the result screen). The X post must include
the live demo link.

## Pre-submit checklist
- [ ] Frontend hosted, live demo link works
- [ ] Repo pushed, repo link works
- [ ] Demo video or screenshot recorded
- [ ] X post live, tags @Filecoin + @FilecoinTLDR, includes demo link
- [ ] Loops registration resolved (currently Forbidden) so you can submit
- [ ] Submission filled with all links above
