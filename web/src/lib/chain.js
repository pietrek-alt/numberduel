import { defineChain } from 'viem'

// Filecoin Calibration testnet (verified from the Synapse SDK source).
export const calibration = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: { name: 'tFIL', symbol: 'tFIL', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.calibration.node.glif.io/rpc/v1'] },
  },
  blockExplorers: {
    default: { name: 'Filfox', url: 'https://calibration.filfox.info' },
  },
  testnet: true,
})

// USDFC token on Calibration (18 decimals).
export const USDFC_ADDRESS = '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0'

// NumberDuel contract — filled in after deploy via web/.env (VITE_DUEL_ADDRESS).
export const DUEL_ADDRESS = import.meta.env.VITE_DUEL_ADDRESS || ''

export const explorerTx = (hash) => `https://calibration.filfox.info/en/tx/${hash}`
export const explorerAddr = (addr) => `https://calibration.filfox.info/en/address/${addr}`
