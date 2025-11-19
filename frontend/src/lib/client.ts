import {
  Address,
  PublicClient,
  WalletClient,
  createPublicClient,
  createWalletClient,
  custom,
  http
} from "viem";
import { defineChain } from "viem/utils";
import { chainConfig } from "../config/contracts";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const chain = defineChain({
  id: chainConfig.id,
  name: chainConfig.name,
  network: "livestock",
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

export const publicClient: PublicClient = createPublicClient({
  chain,
  transport: http(chainConfig.rpcUrl)
});

export async function getWalletClient(account?: Address): Promise<WalletClient> {
  if (!window.ethereum) {
    throw new Error("No injected wallet detected");
  }
  return createWalletClient({
    account,
    chain,
    transport: custom(window.ethereum)
  });
}
