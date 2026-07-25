import {
  AccountBalanceQuery,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TransferTransaction,
} from "@hashgraph/sdk";
import type {
  EscrowGateway,
  EscrowTransfer,
} from "../../application/ports/escrow-gateway.js";

export interface HederaEscrowGatewayOptions {
  network: string;
  /** The escrow account (also the transaction operator/signer). */
  operatorId: string;
  operatorKey: string;
}

/**
 * HBAR escrow backed by the Hedera operator account. The operator holds the
 * escrowed funds and signs the release/refund transfer as itself, so no
 * separate escrow key is needed for the PoC.
 */
export class HederaEscrowGateway implements EscrowGateway {
  private readonly client: Client;
  private readonly operatorId: AccountId;

  constructor(opts: HederaEscrowGatewayOptions) {
    this.client = clientForNetwork(opts.network);
    this.operatorId = AccountId.fromString(opts.operatorId);
    this.client.setOperator(
      this.operatorId,
      PrivateKey.fromStringDer(opts.operatorKey)
    );
  }

  async balanceHbar(): Promise<number> {
    const balance = await new AccountBalanceQuery()
      .setAccountId(this.operatorId)
      .execute(this.client);
    return balance.hbars.toBigNumber().toNumber();
  }

  async transfer(
    toAccountId: string,
    amountHbar: number
  ): Promise<EscrowTransfer> {
    const amount = new Hbar(amountHbar);
    const tx = await new TransferTransaction()
      .addHbarTransfer(this.operatorId, amount.negated())
      .addHbarTransfer(AccountId.fromString(toAccountId), amount)
      .execute(this.client);
    const receipt = await tx.getReceipt(this.client);
    return {
      transactionId: tx.transactionId.toString(),
      status: receipt.status.toString(),
    };
  }
}

function clientForNetwork(network: string): Client {
  switch (network.toLowerCase()) {
    case "mainnet":
      return Client.forMainnet();
    case "previewnet":
      return Client.forPreviewnet();
    case "testnet":
    default:
      return Client.forTestnet();
  }
}
