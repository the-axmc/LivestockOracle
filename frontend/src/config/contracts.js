function toAddress(value) {
    if (!value)
        return undefined;
    return value;
}
const fallbackChainId = 122867;
const fallbackChainName = "Rayls Testnet";
const fallbackRpcUrl = "https://devnet-rpc.rayls.com";
export const chainConfig = {
    id: Number(import.meta.env.VITE_CHAIN_ID || fallbackChainId),
    name: import.meta.env.VITE_CHAIN_NAME || fallbackChainName,
    rpcUrl: import.meta.env.VITE_RPC_URL || fallbackRpcUrl,
    explorer: undefined
};
export const contractAddresses = {
    kycRegistry: toAddress(import.meta.env.VITE_KYC_REGISTRY),
    animalPassport: toAddress(import.meta.env.VITE_ANIMAL_PASSPORT),
    cooperativeAttestor: toAddress(import.meta.env.VITE_COOP_ATTESTOR),
    grantVoucher: toAddress(import.meta.env.VITE_GRANT_VOUCHER),
    speciesLending: toAddress(import.meta.env.VITE_SPECIES_LENDING),
    guaranteePool: toAddress(import.meta.env.VITE_GUARANTEE_POOL),
    speciesToken: toAddress(import.meta.env.VITE_SPECIES_TOKEN),
    speciesOracle: toAddress(import.meta.env.VITE_SPECIES_ORACLE)
};
