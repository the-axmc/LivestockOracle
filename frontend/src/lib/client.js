import { createPublicClient, createWalletClient, custom, http } from "viem";
import { defineChain } from "viem/utils";
import { chainConfig } from "../config/contracts";
export const chain = defineChain({
    id: chainConfig.id,
    name: chainConfig.name,
    network: "rayls-testnet",
    nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
    },
    rpcUrls: {
        default: { http: [chainConfig.rpcUrl] },
        public: { http: [chainConfig.rpcUrl] }
    }
});
export const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl)
});
export async function getWalletClient(account, provider) {
    const transportProvider = provider || window.ethereum;
    if (!transportProvider) {
        throw new Error("No injected wallet detected");
    }
    return createWalletClient({
        account,
        chain,
        transport: custom(transportProvider)
    });
}
