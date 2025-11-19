import { useCallback, useEffect, useState } from "react";
import { getWalletClient } from "../lib/client";
import { chainConfig } from "../config/contracts";
const chainHex = `0x${chainConfig.id.toString(16)}`;
async function ensureChain(provider) {
    if (!provider)
        throw new Error("Wallet not found");
    try {
        await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainHex }]
        });
    }
    catch (err) {
        if (err?.code === 4902) {
            await provider.request({
                method: "wallet_addEthereumChain",
                params: [
                    {
                        chainId: chainHex,
                        chainName: chainConfig.name,
                        rpcUrls: [chainConfig.rpcUrl],
                        nativeCurrency: {
                            name: "Ether",
                            symbol: "ETH",
                            decimals: 18
                        }
                    }
                ]
            });
        }
        else {
            throw err;
        }
    }
}
export function useWallet() {
    const [state, setState] = useState({});
    const [connecting, setConnecting] = useState(false);
    const connect = useCallback(async () => {
        if (connecting)
            return;
        if (!window.ethereum)
            throw new Error("Wallet not found");
        setConnecting(true);
        try {
            await ensureChain(window.ethereum);
            const [account] = (await window.ethereum.request({
                method: "eth_requestAccounts"
            }));
            const chainIdHex = (await window.ethereum.request({
                method: "eth_chainId"
            }));
            setState({ address: account, chainId: Number(chainIdHex) });
        }
        finally {
            setConnecting(false);
        }
    }, [connecting]);
    const disconnect = useCallback(() => setState({}), []);
    useEffect(() => {
        if (!window.ethereum)
            return;
        const handleAccountsChanged = (accounts) => {
            setState((prev) => ({ ...prev, address: accounts[0] }));
        };
        const handleChainChanged = (hex) => {
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
        if (!state.address)
            throw new Error("Connect wallet first");
        await ensureChain(window.ethereum);
        return getWalletClient(state.address);
    }, [state.address]);
    const address = state.address;
    const chainId = state.chainId;
    return {
        address,
        chainId,
        connecting,
        connect,
        disconnect,
        getSigner
    };
}
