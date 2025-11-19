/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_KYC_REGISTRY?: string;
  readonly VITE_ANIMAL_PASSPORT?: string;
  readonly VITE_COOP_ATTESTOR?: string;
  readonly VITE_GRANT_VOUCHER?: string;
  readonly VITE_SPECIES_LENDING?: string;
  readonly VITE_GUARANTEE_POOL?: string;
  readonly VITE_GRANTOR_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
