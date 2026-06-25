import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { calibration } from './chain'

export const wagmiConfig = createConfig({
  chains: [calibration],
  connectors: [injected()],
  transports: {
    [calibration.id]: http(),
  },
})
