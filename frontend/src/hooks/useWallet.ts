import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { getWalletClient } from "../lib/client";

interface WalletState {
  address?: Address;
  chainId?: number;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({});
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      if (!window.ethereum) throw new Error("Wallet not found");
      const [account] = (await window.ethereum.request({
        method: "eth_requestAccounts"
      })) as Address[];
      const chainIdHex = (await window.ethereum.request({
        method: "eth_chainId"
      })) as string;
      setState({ address: account, chainId: Number(chainIdHex) });
    } finally {
      setConnecting(false);
    }
  }, [connecting]);

  const disconnect = useCallback(() => setState({}), []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: Address[]) => {
      setState((prev) => ({ ...prev, address: accounts[0] }));
    };
    const handleChainChanged = (hex: string) => {
      setState((prev) => ({ ...prev, chainId: Number(hex) }));
    };
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const getSigner = useCallback(async () => {
    if (!state.address) throw new Error("Connect wallet first");
    return getWalletClient(state.address);
  }, [state.address]);

  return {
    ...state,
    connecting,
    connect,
    disconnect,
    getSigner
  };
}
