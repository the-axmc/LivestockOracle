import { useCallback, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getWalletClient } from "../lib/client";
import { chainConfig } from "../config/contracts";
export function useWallet() {
    const { ready, authenticated, login, logout } = usePrivy();
    const { wallets } = useWallets();
    const [connecting, setConnecting] = useState(false);
    const connectedWallet = useMemo(() => {
        if (!wallets?.length)
            return undefined;
        return (wallets.find((wallet) => wallet.address && wallet.chainId === chainConfig.id) ||
            wallets.find((wallet) => wallet.address) ||
            wallets[0]);
    }, [wallets]);
    const connect = useCallback(async () => {
        if (connecting || !ready)
            return;
        if (authenticated && connectedWallet)
            return;
        setConnecting(true);
        try {
            await login();
        }
        finally {
            setConnecting(false);
        }
    }, [authenticated, connectedWallet, connecting, login, ready]);
    const disconnect = useCallback(async () => {
        if (!authenticated)
            return;
        await logout();
    }, [authenticated, logout]);
    const getSigner = useCallback(async () => {
        if (!connectedWallet?.address)
            throw new Error("Connect wallet first");
        const provider = await connectedWallet.getEthereumProvider();
        return getWalletClient(connectedWallet.address, provider);
    }, [connectedWallet]);
    const address = connectedWallet?.address;
    const chainId = typeof connectedWallet?.chainId === "number" ? connectedWallet.chainId : undefined;
    return {
        address,
        chainId,
        connecting: connecting || !ready,
        connect,
        disconnect,
        getSigner
    };
}
