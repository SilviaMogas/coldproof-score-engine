import type {
  EscrowGateway,
  EscrowTransfer,
} from "../../application/ports/escrow-gateway.js";

/**
 * No-op escrow gateway used when settlement is not configured (local dev). It
 * reports a zero balance and refuses transfers; the settlement use cases guard
 * on the disabled config, so these methods are never reached in practice.
 */
export class NoopEscrowGateway implements EscrowGateway {
  async balanceHbar(): Promise<number> {
    return 0;
  }

  async transfer(): Promise<EscrowTransfer> {
    throw new Error("escrow gateway is disabled");
  }
}
