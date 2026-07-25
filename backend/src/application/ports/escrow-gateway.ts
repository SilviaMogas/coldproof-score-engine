/** Receipt of an escrow HBAR transfer. */
export interface EscrowTransfer {
  transactionId: string;
  status: string;
}

/**
 * Moves the escrowed HBAR held by the backend's operator (escrow) account.
 *
 * In this PoC the operator account acts as the escrow float: the shipper funds
 * it out-of-band, the backend confirms the balance covers the delivery, and on
 * settlement the backend (as operator) transfers the amount to the carrier or
 * refunds the shipper.
 */
export interface EscrowGateway {
  /** Current HBAR balance of the escrow (operator) account. */
  balanceHbar(): Promise<number>;
  /** Transfers `amountHbar` from the escrow account to `toAccountId`. */
  transfer(toAccountId: string, amountHbar: number): Promise<EscrowTransfer>;
}
