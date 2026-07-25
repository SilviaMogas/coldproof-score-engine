# ColdProof

ColdProof keeps one business workflow and selects its blockchain adapters at
runtime:

```env
BLOCKCHAIN_PROVIDER=hedera
```

or:

```env
BLOCKCHAIN_PROVIDER=sepolia
```

The application and domain layers are shared and unchanged. Both providers
implement the same three ports:

- `ConsensusLog`: append an authenticated sensor reading.
- `ConsensusReader`: read the immutable, ordered history used for settlement.
- `EscrowGateway`: check the escrow float and transfer a release or refund.

## Provider mapping

| Business capability | Hedera | Sepolia |
| --- | --- | --- |
| Immutable log | HCS topic | `ColdProofConsensus` events |
| History reader | Hedera Mirror Node | Sepolia RPC event query |
| Escrow float | Hedera operator account | Sepolia oracle wallet |
| Settlement asset | HBAR | Sepolia ETH |

This deliberately reproduces the existing Hedera behavior. The blockchain is
chosen only in configuration/composition; use cases do not branch on the
provider.

## Local verification

```sh
cd backend
npm ci
npm run typecheck
npm test

cd ../frontend
npm ci
npm run build

cd ../contracts
npm ci
npm test
```

Never commit `.env` files or private keys.

## Current Sepolia consensus deployment

- Contract: `0xD76568A73Ce725CEC073b7CDE1F86bd4723EA7c3`
- Start block: `11350115`
- Transaction:
  `0x8606ded77e469361c2dfb73290d9daa16af379b5d8019de382cbba937b2649b2`

Use the contract address and block as `SEPOLIA_CONSENSUS_ADDRESS` and
`SEPOLIA_CONSENSUS_START_BLOCK`.
