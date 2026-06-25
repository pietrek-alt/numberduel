# NumberDuel — Provably-Fair 1v1 Duel on Filecoin

> Two players. One secret number. Real USDFC on the line. Nobody can cheat,
> because the number is sealed on Filecoin before anyone guesses.

Submission target: **FilecoinTLDR Builder Challenge - Cycle 1** (sponsor: FilecoinTLDR).
Deadline: **Jun 26, 2026, 11:59 PM UTC**. Network: **Filecoin Calibration testnet**.

---

## The mechanic (one clear thing)

1. **Setter** picks a secret number 1-10 and locks a stake in USDFC.
   - The app hashes the number with a random salt: `keccak256(number, salt)`.
   - That sealed fingerprint is written immutably on Filecoin. The setter can
     never change their number after this point, and the raw number is not
     readable.
2. **Setter shares a duel link.**
3. **Guesser** matches the same USDFC stake and submits one guess, 1-10.
4. **Reveal:** the setter reveals `(number, salt)`. The contract checks it
   against the sealed fingerprint.
   - Guess correct → guesser takes the whole pot (2x stake).
   - Guess wrong → setter takes the pot.
5. The sealed fingerprint is the receipt. Anyone can verify the setter could not
   have moved the number after the guess landed.

The fairness is the product. Filecoin is not hidden backend storage; the whole
game only works because the commitment is immutable and public.

## Why Filecoin (meaningful use, not decoration)

Two Filecoin primitives are load-bearing:

- **USDFC** — the Filecoin-native stablecoin is the stake, the pot, and the
  payout. It is the money in the game, not a side feature.
  Calibration token: `0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0` (18 decimals).
- **Immutable commitment on Filecoin** — the sealed number lives on Filecoin
  (FVM contract state in the MVP; optionally pinned to Filecoin storage via the
  Synapse SDK for a PieceCID, see stretch goal). Without immutability the game
  is cheatable; with it, it is trustless.

This maps directly to the 30%-weighted judging line: "Does the project actually
use Filecoin, FOC, Synapse SDK, PDP, retrieval, storage, **payments**, or
another relevant Filecoin primitive in a meaningful way?" Yes: payments (USDFC)
plus an immutable on-chain commitment.

## Architecture decision (and one honest change from the pitch)

Earlier plan said "store the sealed fingerprint on Filecoin storage via the
Synapse SDK." After reading the SDK, its storage path is heavyweight: Warm
Storage service, data sets, payment rails, provider selection, and PDP proofs.
That is too much surface area to get working reliably by tomorrow, and a
half-working storage integration would tank the 25% "working demo" score.

**Decision:** the MVP stores the commitment immutably in **FVM contract state on
Filecoin Calibration**. It is still on Filecoin, still immutable, still public,
and it ships. The `Synapse SDK` piece-pinning is a clearly-scoped **stretch
goal** (below) we only attempt once the core duel works end to end.

### MVP stack
- **Contract:** `NumberDuel.sol`, Solidity, deployed to Filecoin Calibration
  (chainId `314159`, RPC `https://api.calibration.node.glif.io/rpc/v1`).
  Holds USDFC escrow + the commitment + settlement logic.
- **Toolchain:** Hardhat (compile, test, deploy).
- **Frontend:** Vite + React + wagmi/viem + MetaMask on Calibration.
- **Money:** test USDFC only. No real value at risk.

### Contract surface (NumberDuel.sol)
- `createDuel(bytes32 commit, uint256 stake)` — setter escrows `stake` USDFC
  (after ERC-20 `approve`), stores `commit`. Returns a `duelId`.
- `joinDuel(uint256 duelId, uint8 guess)` — guesser escrows the same `stake`,
  records the guess. One guesser per duel.
- `reveal(uint256 duelId, uint8 number, bytes32 salt)` — verifies
  `keccak256(abi.encodePacked(number, salt)) == commit`, then pays the winner
  `2 * stake` USDFC.
- `claimTimeout(uint256 duelId)` — safety valve so funds never lock: if the
  setter never reveals within a deadline, the guesser can reclaim the pot (and
  vice versa before anyone joins).
- Events for every state change so the frontend and a proof page can render.

Guardrails: checks-effects-interactions, reentrancy-safe payout, no `selfdestruct`,
no admin key holding funds, explicit timeout refunds.

## The 90-second demo

1. Setter picks **7**, locks **5 USDFC**. App shows the sealed commitment landing
   on Filecoin: "your number is locked, you cannot change it now."
2. Open the duel link in a second wallet (a judge). Judge matches **5 USDFC**,
   guesses **4**.
3. Setter hits reveal: it was **7**. Contract verifies against the sealed
   commitment, pays the setter **10 USDFC**.
4. Show the immutable commitment + the Filfox transaction: proof the 7 was sealed
   before the guess. Nobody had to trust anybody.

## Judging alignment (FilecoinTLDR rubric)

- Meaningful Filecoin use (30%): USDFC payments + immutable on-chain commitment.
- Working demo (25%): one tight, real, on-chain flow; tested before the deadline.
- Creativity / usefulness (20%): an interactive PvP money game where Filecoin is
  the trust layer; not an upload-a-file app.
- Clarity + showcase (15%): clean README, demo video, X post tagging @Filecoin
  and @FilecoinTLDR.
- AI-guided build (10%): this whole thing is built with Claude Code; we keep an
  AI build log.

## Stretch goal (only after the core works)

Use `@filoz/synapse-sdk` to pin the sealed commitment payload to Filecoin storage
and surface its **PieceCID** on the proof page. This upgrades the storage story
from "immutable FVM state" to "immutable FVM state + a Filecoin storage piece
with PDP," which is the strongest possible answer to "uses the Synapse SDK." Do
not let this block the demo.

## Submission checklist (FilecoinTLDR requirements)

- [ ] Project title, short description, **live demo link**, **repo link**.
- [ ] Explanation of how it uses FOC / the Filecoin stack (this doc).
- [ ] The app's main mechanic + how Filecoin is in the product experience.
- [ ] Short **AI build log**.
- [ ] Public **X post**: live demo link, screenshot or short video, tag
      **@Filecoin** and **@FilecoinTLDR**.

## Known blocker (platform, not build)

The `loops` CLI returns `Forbidden` on project/knowledge/artifact calls for this
account: it is authenticated with credits, but not registered as a participant
(registration closed Jun 19). This only affects submitting through loops, not
building. Resolve via the Loops House web playground or the FilecoinTLDR Discord
before the deadline.

## Facts (verified from the Synapse SDK source)

- Calibration chainId: `314159`; RPC `https://api.calibration.node.glif.io/rpc/v1`;
  explorer `https://calibration.filfox.info`; native tFIL (18 decimals).
- USDFC (Calibration): `0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0`, 18 decimals.
- Synapse SDK packages: `@filoz/synapse-sdk` (+ `viem`), `@filoz/synapse-core`,
  `@filoz/synapse-react`. Docs: https://docs.filecoin.cloud/
- tFIL + test USDFC faucet: Filecoin Calibration faucet (get tFIL for gas; USDFC
  test tokens via the Secured Finance / Chainsafe faucet).
