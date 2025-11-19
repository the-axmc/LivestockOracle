import type { Address } from "viem";
import { truncateAddress } from "../utils/format";

interface Props {
  address?: Address;
  chainId?: number;
  connect(): Promise<void> | void;
  disconnect(): void;
  connecting: boolean;
}

export function WalletCard({ address, chainId, connect, disconnect, connecting }: Props) {
  return (
    <div className="card">
      <div className="section-title">
        <h3>Wallet</h3>
      </div>
      {address ? (
        <>
          <p>
            Connected as <strong>{truncateAddress(address)}</strong>
          </p>
          <p>
            Chain ID: <strong>{chainId}</strong>
          </p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={connect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
      )}
    </div>
  );
}
