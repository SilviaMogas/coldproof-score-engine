# ColdProof

ColdProof tracks signed cold-chain sensor readings and settles delivery escrow
on Ethereum Sepolia.

## Architecture

1. An ESP32 reads a DS18B20 sensor and signs the canonical reading with Ed25519.
2. The Fastify backend validates the signature and stores the reading.
3. When the device belongs to an `in_transit` delivery, the backend oracle calls
   `ColdProofEscrow.recordReading` on Sepolia.
4. The contract emits an indexable `ReadingRecorded` event and updates delivery
   compliance.
5. The oracle releases the escrow to the payee after enough compliant readings,
   or refunds the payer after a violation. Anyone can trigger an expired refund.

The contract events are the integration boundary for a future The Graph
subgraph.

## Contract workflow

The backend delivery UUID is represented on-chain as `keccak256(utf8(uuid))`.
The device ID uses the same convention.

1. Deploy `ColdProofEscrow` with the backend oracle address.
2. A payer calls `fundDelivery` with ETH, the payee, rule range, required reading
   count and deadline.
3. The payer or oracle calls `startDelivery`.
4. The backend submits readings using its configured oracle key.
5. The oracle calls `release` when conditions pass or `refund` after a
   violation. `refundExpired` is permissionless after the deadline.

Temperatures are represented as integer thousandths of a Celsius degree. For
example, `4.25 C` is `4250`.

## Local verification

```sh
cd contracts
npm ci
npm test

cd ../backend
npm ci
npm run typecheck
npm test

cd ../frontend
npm ci
npm run build
```

## Sepolia deployment

Copy `contracts/.env.example` to `contracts/.env`, fund the deployer with
Sepolia ETH and set `ORACLE_ADDRESS` to the backend wallet address.

```sh
cd contracts
npm run deploy:sepolia
```

Copy the resulting contract address plus the RPC URL and oracle private key to
the backend environment using `backend/.env.example`.

Never commit `.env` files or private keys.

Current Sepolia deployment:

- `ColdProofEscrow`: `0x424194558D1c3033da1EDd51C40Bc5F089A1f791`
- Deployment block: `11349913`
- Deployment transaction:
  `0x27a16467b2f187019244399405ed4ab7094a10163fdf741e5d6df383a8b24c0f`
- Oracle: `0x7D4954f4b1db61a32D7f44c8eDd5af2b9b4a64FE`

Machine-readable metadata is stored in `contracts/deployments/sepolia.json`.

## Events for The Graph

- `DeliveryFunded`
- `DeliveryStarted`
- `ReadingRecorded`
- `DeliveryReleased`
- `DeliveryRefunded`
- `OracleUpdated`
- `OwnershipTransferred`

The three most useful indexed keys are `deliveryId`, `deviceIdHash` and sensor
`sequence`. The deployment block printed by the deploy script should be used as
the subgraph data source `startBlock`.
