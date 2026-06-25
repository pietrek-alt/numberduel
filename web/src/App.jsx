import { useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  usePublicClient,
  useWriteContract,
  useReadContract,
} from 'wagmi'
import { keccak256, encodePacked, parseUnits, formatUnits, toHex, decodeEventLog } from 'viem'
import { numberDuelAbi } from './lib/numberDuelAbi'
import { erc20Abi } from './lib/erc20Abi'
import { calibration, USDFC_ADDRESS, DUEL_ADDRESS, explorerAddr } from './lib/chain'
import './App.css'

const STATUS = ['None', 'Open', 'Joined', 'Settled', 'Cancelled']

const randomSalt = () => toHex(crypto.getRandomValues(new Uint8Array(32)))
const commitOf = (number, salt) => keccak256(encodePacked(['uint8', 'bytes32'], [Number(number), salt]))
const secretKey = (id) => `nd:${DUEL_ADDRESS}:${id}`
const saveSecret = (id, number, salt) =>
  localStorage.setItem(secretKey(id), JSON.stringify({ number: Number(number), salt }))
const loadSecret = (id) => {
  try {
    return JSON.parse(localStorage.getItem(secretKey(id)))
  } catch {
    return null
  }
}
const sameAddr = (a, b) => a && b && a.toLowerCase() === b.toLowerCase()
const duelLink = (id) => `${window.location.origin}${window.location.pathname}?duel=${id}`

export default function App() {
  const duelId = new URLSearchParams(window.location.search).get('duel')
  const { isConnected } = useAccount()
  const chainId = useChainId()

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="dice">🎲</span> NumberDuel
        </h1>
        <ConnectBar />
      </header>

      <p className="tagline">
        One secret number. Real USDFC. Nobody can cheat, because the number is sealed on Filecoin
        before anyone guesses.
      </p>

      {!DUEL_ADDRESS && (
        <div className="banner warn">
          Contract address not set. Deploy NumberDuel and put it in <code>web/.env</code> as{' '}
          <code>VITE_DUEL_ADDRESS</code>, then restart the dev server.
        </div>
      )}

      {!isConnected ? (
        <div className="card center">Connect a wallet on Filecoin Calibration to play.</div>
      ) : chainId !== calibration.id ? (
        <WrongChain />
      ) : !DUEL_ADDRESS ? null : duelId ? (
        <DuelView id={duelId} />
      ) : (
        <CreateDuel />
      )}

      <footer className="foot">
        Filecoin Calibration testnet · USDFC ·{' '}
        {DUEL_ADDRESS ? (
          <a href={explorerAddr(DUEL_ADDRESS)} target="_blank" rel="noreferrer">
            contract
          </a>
        ) : (
          'not deployed'
        )}
      </footer>
    </div>
  )
}

function ConnectBar() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const injected = connectors[0]

  if (isConnected) {
    return (
      <button className="pill" onClick={() => disconnect()}>
        {address.slice(0, 6)}…{address.slice(-4)} · disconnect
      </button>
    )
  }
  return (
    <button className="pill primary" onClick={() => connect({ connector: injected })}>
      Connect wallet
    </button>
  )
}

function WrongChain() {
  const { switchChain, isPending } = useSwitchChain()
  return (
    <div className="card center">
      <p>You're on the wrong network.</p>
      <button className="btn" disabled={isPending} onClick={() => switchChain({ chainId: calibration.id })}>
        {isPending ? 'Switching…' : 'Switch to Filecoin Calibration'}
      </button>
    </div>
  )
}

// Approve USDFC for the duel contract if the current allowance is too low.
function useEnsureApproval() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  return async (amount) => {
    const allowance = await publicClient.readContract({
      address: USDFC_ADDRESS,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [address, DUEL_ADDRESS],
    })
    if (allowance < amount) {
      const hash = await writeContractAsync({
        address: USDFC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [DUEL_ADDRESS, amount],
      })
      await publicClient.waitForTransactionReceipt({ hash })
    }
  }
}

function CreateDuel() {
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const ensureApproval = useEnsureApproval()

  const [number, setNumber] = useState(7)
  const [stake, setStake] = useState('5')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const start = async () => {
    setBusy(true)
    setMsg('')
    try {
      const salt = randomSalt()
      const commit = commitOf(number, salt)
      const stakeWei = parseUnits(stake || '0', 18)
      if (stakeWei <= 0n) throw new Error('Stake must be greater than 0.')

      setMsg('Approving USDFC…')
      await ensureApproval(stakeWei)

      setMsg('Sealing your number on Filecoin…')
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: numberDuelAbi,
        functionName: 'createDuel',
        args: [commit, stakeWei, 1, 10],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      let newId
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: numberDuelAbi, data: log.data, topics: log.topics })
          if (ev.eventName === 'DuelCreated') {
            newId = ev.args.duelId
            break
          }
        } catch {
          /* not our event */
        }
      }
      if (newId === undefined) throw new Error('Could not read the new duel id from the receipt.')

      saveSecret(newId.toString(), number, salt)
      window.location.search = `?duel=${newId.toString()}`
    } catch (e) {
      setMsg(e.shortMessage || e.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Start a duel</h2>
      <p className="muted">
        Pick a secret number 1–10 and lock a USDFC stake. Your number gets sealed on Filecoin. You
        cannot change it, and your opponent cannot peek.
      </p>

      <label className="field">
        <span>Your secret number</span>
        <div className="numgrid">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`num ${number === n ? 'sel' : ''}`}
              onClick={() => setNumber(n)}
              type="button"
            >
              {n}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span>Stake (USDFC each)</span>
        <input
          className="text"
          inputMode="decimal"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
        />
      </label>

      <button className="btn big" disabled={busy} onClick={start}>
        {busy ? msg || 'Working…' : `🔒 Seal ${number} & lock ${stake} USDFC`}
      </button>
      {msg && !busy && <p className="err">{msg}</p>}
    </div>
  )
}

function DuelView({ id }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const ensureApproval = useEnsureApproval()

  const { data: duel, refetch } = useReadContract({
    address: DUEL_ADDRESS,
    abi: numberDuelAbi,
    functionName: 'getDuel',
    args: [BigInt(id)],
    query: { refetchInterval: 4000 },
  })

  const [guess, setGuess] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      await refetch()
    } catch (e) {
      setMsg(e.shortMessage || e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (!duel) return <div className="card center">Loading duel #{id}…</div>
  if (Number(duel.status) === 0) return <div className="card center">Duel #{id} does not exist.</div>

  const status = Number(duel.status)
  const isSetter = sameAddr(address, duel.setter)
  const isGuesser = sameAddr(address, duel.guesser)
  const pot = formatUnits(duel.stake * 2n, 18)
  const stakeStr = formatUnits(duel.stake, 18)
  const secret = loadSecret(id)

  const copyLink = async () => {
    await navigator.clipboard.writeText(duelLink(id))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const join = () =>
    run(async () => {
      await ensureApproval(duel.stake)
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: numberDuelAbi,
        functionName: 'joinDuel',
        args: [BigInt(id), guess],
      })
      await publicClient.waitForTransactionReceipt({ hash })
    })

  const reveal = () =>
    run(async () => {
      if (!secret)
        throw new Error('Secret not found in this browser. Open the link in the browser you set the duel from.')
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: numberDuelAbi,
        functionName: 'reveal',
        args: [BigInt(id), secret.number, secret.salt],
      })
      await publicClient.waitForTransactionReceipt({ hash })
    })

  const claim = () =>
    run(async () => {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: numberDuelAbi,
        functionName: 'claimUnrevealed',
        args: [BigInt(id)],
      })
      await publicClient.waitForTransactionReceipt({ hash })
    })

  const cancel = () =>
    run(async () => {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: numberDuelAbi,
        functionName: 'cancelOpenDuel',
        args: [BigInt(id)],
      })
      await publicClient.waitForTransactionReceipt({ hash })
    })

  return (
    <div className="card">
      <div className="duelhead">
        <h2>Duel #{id}</h2>
        <span className={`tag s${status}`}>{STATUS[status]}</span>
      </div>
      <p className="muted">
        Stake {stakeStr} USDFC each · pot {pot} USDFC · range {duel.minNumber}–{duel.maxNumber}
      </p>

      {/* OPEN */}
      {status === 1 && isSetter && (
        <>
          <div className="banner ok">
            Your number is sealed on Filecoin. You can't change it now.{' '}
            {secret && (
              <>
                You picked <b>{secret.number}</b> (only you can see this).
              </>
            )}
          </div>
          <p>Send this link to your opponent:</p>
          <div className="linkrow">
            <input className="text" readOnly value={duelLink(id)} />
            <button className="btn" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="muted">Waiting for someone to join and guess…</p>
          <button className="btn ghost" disabled={busy} onClick={cancel}>
            Cancel & refund my stake
          </button>
        </>
      )}

      {status === 1 && !isSetter && (
        <>
          <p>Match the stake and take your guess. Crack the number, take the pot.</p>
          <div className="numgrid">
            {Array.from({ length: duel.maxNumber - duel.minNumber + 1 }, (_, i) => duel.minNumber + i).map(
              (n) => (
                <button key={n} className={`num ${guess === n ? 'sel' : ''}`} onClick={() => setGuess(n)} type="button">
                  {n}
                </button>
              )
            )}
          </div>
          <button className="btn big" disabled={busy} onClick={join}>
            {busy ? msg || 'Working…' : `🎯 Match ${stakeStr} USDFC & guess ${guess}`}
          </button>
        </>
      )}

      {/* JOINED */}
      {status === 2 && isSetter && (
        <>
          <div className="banner ok">Your opponent guessed. Reveal your number to settle.</div>
          <button className="btn big" disabled={busy} onClick={reveal}>
            {busy ? msg || 'Working…' : '🔓 Reveal & settle'}
          </button>
        </>
      )}

      {status === 2 && isGuesser && (
        <>
          <div className="banner">
            You guessed <b>{duel.guess}</b>. Waiting for the setter to reveal…
          </div>
          <button className="btn ghost" disabled={busy} onClick={claim}>
            Setter stalling? Claim the pot after the reveal window
          </button>
        </>
      )}

      {status === 2 && !isSetter && !isGuesser && (
        <p className="muted">Opponent has guessed {duel.guess}. Waiting for the reveal.</p>
      )}

      {/* SETTLED */}
      {status === 3 && (
        <div className="result">
          <div className="bignum">{duel.revealedNumber || '—'}</div>
          <p className="muted">
            The secret number was {duel.revealedNumber ? duel.revealedNumber : 'never revealed'}.
          </p>
          <h3>
            {sameAddr(address, duel.winner)
              ? '🏆 You won the pot!'
              : `Winner: ${duel.winner.slice(0, 6)}…${duel.winner.slice(-4)}`}
          </h3>
          <p>
            {duel.revealedNumber
              ? Number(duel.revealedNumber) === Number(duel.guess)
                ? `Guess ${duel.guess} was correct — guesser took ${pot} USDFC.`
                : `Guess ${duel.guess} missed — setter kept ${pot} USDFC.`
              : `Setter never revealed — guesser claimed ${pot} USDFC.`}
          </p>
          <a className="btn ghost" href={explorerAddr(DUEL_ADDRESS)} target="_blank" rel="noreferrer">
            Verify on Filfox
          </a>
        </div>
      )}

      {/* CANCELLED */}
      {status === 4 && <div className="banner">Duel cancelled. The setter's stake was refunded.</div>}

      {msg && !busy && <p className="err">{msg}</p>}

      <p className="commit">
        Sealed commitment: <code>{duel.commit.slice(0, 18)}…</code>
      </p>
      <a className="newlink" href={window.location.pathname}>
        ← start a new duel
      </a>
    </div>
  )
}
