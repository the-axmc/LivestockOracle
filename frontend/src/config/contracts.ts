import type { Address } from "viem";

function toAddress(value?: string): Address | undefined {
  if (!value) return undefined;
  return value as Address;
}

export interface ContractAddresses {
  kycRegistry?: Address;
  animalPassport?: Address;
  cooperativeAttestor?: Address;
  grantVoucher?: Address;
  speciesLending?: Address;
  guaranteePool?: Address;
}

export const chainConfig = {
  id: Number(import.meta.env.VITE_CHAIN_ID || 31337),
  name: "Livestock",
  rpcUrl:
    import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545",
  explorer: undefined
};

export const contractAddresses: ContractAddresses = {
  kycRegistry: toAddress(import.meta.env.VITE_KYC_REGISTRY),
  animalPassport: toAddress(import.meta.env.VITE_ANIMAL_PASSPORT),
  cooperativeAttestor: toAddress(import.meta.env.VITE_COOP_ATTESTOR),
  grantVoucher: toAddress(import.meta.env.VITE_GRANT_VOUCHER),
  speciesLending: toAddress(import.meta.env.VITE_SPECIES_LENDING),
  guaranteePool: toAddress(import.meta.env.VITE_GUARANTEE_POOL)
};
