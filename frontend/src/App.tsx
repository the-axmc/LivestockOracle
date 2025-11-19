import { useState } from "react";
import type { Address, Hex } from "viem";
import { stringToHex } from "viem";
import { useWallet } from "./hooks/useWallet";
import { publicClient } from "./lib/client";
import { contractAddresses } from "./config/contracts";
import {
  kycRegistryAbi,
  animalPassportAbi,
  cooperativeAttestorAbi,
  grantVoucherAbi,
  guaranteePoolAbi
} from "./lib/abis";
import { WalletCard } from "./components/WalletCard";
import { AuthLog } from "./components/AuthLog";
import { useAuthLogs } from "./state/useAuthLogs";
import { OnboardForm } from "./components/forms/OnboardForm";
import { PassportForm } from "./components/forms/PassportForm";
import { GrantVoucherForm } from "./components/forms/GrantVoucherForm";
import { CoopAttestationForm } from "./components/forms/CoopAttestationForm";
import { GrantDepositForm } from "./components/forms/GrantDepositForm";
import type { ActorType } from "./types";

const roleMatrix: Record<ActorType, [boolean, boolean, boolean, boolean, boolean]> = {
  livestock: [true, false, false, false, false],
  cooperative: [false, false, true, false, false],
  bank: [false, true, false, false, false]
};

function requireAddress(addr?: Address, name?: string): Address {
  if (!addr) throw new Error(`${name || "address"} is not configured`);
  return addr;
}

export default function App() {
  const wallet = useWallet();
  const { logs, pushLog, stats } = useAuthLogs();
  const [status, setStatus] = useState<string>("");
  const [lastVoucher, setLastVoucher] = useState<number>();

  const waitForTx = async (hash: Hex) => {
    setStatus("Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    setStatus("Confirmed block " + receipt.blockNumber);
    return receipt.transactionHash;
  };

  const ensureWallet = async () => {
    if (!wallet.address) throw new Error("Connect a wallet first");
    return wallet.getSigner();
  };

  const handleOnboard = async ({ target, type }: { target: string; type: ActorType }) => {
    const signer = await ensureWallet();
    const kycAddress = requireAddress(contractAddresses.kycRegistry, "KYCRegistry");
    const tx1 = await signer.writeContract({
      address: kycAddress,
      abi: kycRegistryAbi,
      functionName: "setKYCStatus",
      args: [target as Address, true]
    });
    const txHash = await waitForTx(tx1);

    const [borrower, bank, coop, oracleBot, grantor] = roleMatrix[type];
    const tx2 = await signer.writeContract({
      address: kycAddress,
      abi: kycRegistryAbi,
      functionName: "setUserRoles",
      args: [target as Address, borrower, bank, coop, oracleBot, grantor]
    });
    const txHash2 = await waitForTx(tx2);

    pushLog(type, {
      actor: target,
      action: "KYC approved",
      details: `Roles updated (${type})`,
      txHash: txHash2,
      timestamp: Date.now()
    });

    setStatus(`Onboarded ${target} (${txHash}, ${txHash2})`);
  };

  const handlePassport = async (payload: {
    owner: string;
    speciesId: number;
    metadataHash: string;
  }) => {
    const signer = await ensureWallet();
    const passportAddr = requireAddress(contractAddresses.animalPassport, "AnimalPassportRegistry");
    const tx = await signer.writeContract({
      address: passportAddr,
      abi: animalPassportAbi,
      functionName: "mintPassport",
      args: [payload.owner as Address, BigInt(payload.speciesId), payload.metadataHash as Hex]
    });
    const txHash = await waitForTx(tx);
    pushLog("livestock", {
      actor: payload.owner,
      action: "Passport minted",
      details: `Species ${payload.speciesId}`,
      txHash: txHash,
      timestamp: Date.now()
    });
  };

  const handleVoucher = async (payload: {
    beneficiary: string;
    amount: string;
    payoutDate: string;
    grantRef: string;
  }) => {
    const signer = await ensureWallet();
    const voucherAddr = requireAddress(contractAddresses.grantVoucher, "GrantVoucherRegistry");
    const payoutTs = Math.floor(new Date(payload.payoutDate).getTime() / 1000);
    const ref = payload.grantRef.startsWith("0x")
      ? (payload.grantRef as Hex)
      : (stringToHex(payload.grantRef, { size: 32 }) as Hex);
    const tx = await signer.writeContract({
      address: voucherAddr,
      abi: grantVoucherAbi,
      functionName: "mintVoucher",
      args: [
        payload.beneficiary as Address,
        BigInt(payload.amount || "0"),
        BigInt(payoutTs),
        ref
      ]
    });
    const txHash = await waitForTx(tx);
    pushLog("bank", {
      actor: payload.beneficiary,
      action: "Grant voucher minted",
      details: `${payload.amount} wei due on ${payload.payoutDate}`,
      txHash,
      timestamp: Date.now()
    });
    setLastVoucher(Date.now());
  };

  const handleAttestation = async (payload: {
    farmer: string;
    active: boolean;
    deliveries: number;
    goodStanding: boolean;
    rating: number;
  }) => {
    const signer = await ensureWallet();
    const coopAddr = requireAddress(contractAddresses.cooperativeAttestor, "CooperativeAttestor");
    const tx = await signer.writeContract({
      address: coopAddr,
      abi: cooperativeAttestorAbi,
      functionName: "setMembership",
      args: [
        payload.farmer as Address,
        payload.active,
        BigInt(payload.deliveries),
        payload.goodStanding,
        payload.rating
      ]
    });
    const txHash = await waitForTx(tx);
    pushLog("cooperative", {
      actor: payload.farmer,
      action: payload.active ? "Membership updated" : "Membership paused",
      details: `${payload.deliveries} deliveries • rating ${payload.rating}`,
      txHash,
      timestamp: Date.now()
    });
  };

  const handleGrantDeposit = async ({ amount }: { amount: string }) => {
    const signer = await ensureWallet();
    const guaranteeAddr = requireAddress(contractAddresses.guaranteePool, "GuaranteePool");
    const tx = await signer.writeContract({
      address: guaranteeAddr,
      abi: guaranteePoolAbi,
      functionName: "depositGrant",
      args: [BigInt(amount || "0")]
    });
    const txHash = await waitForTx(tx);
    pushLog("bank", {
      actor: wallet.address || "",
      action: "Guarantee deposit",
      details: `${amount} wei deposited`,
      txHash,
      timestamp: Date.now()
    });
  };

  const walletConnected = Boolean(wallet.address);

  return (
    <main className="grid" style={{ gap: "32px" }}>
      <header className="card" style={{ textAlign: "left" }}>
        <h1>Livestock Oracle Control Center</h1>
        <p>
          Manage onboarding, cooperative attestations, grant vouchers, and grant-backed
          deposits across the deployed contracts. Every interaction feeds into the
          Livestock Oracle data room.
        </p>
        <p>
          <small>
            RPC: {contractAddresses.kycRegistry ? "configured" : "missing"} • Total Auth
            events tracked: {stats.total}
          </small>
        </p>
      </header>

      <div className="grid split">
        <WalletCard
          address={wallet.address}
          chainId={wallet.chainId}
          connect={wallet.connect}
          disconnect={wallet.disconnect}
          connecting={wallet.connecting}
        />
        <div className="card">
          <div className="section-title">
            <h3>Live Status</h3>
          </div>
          <p>{status || "No transactions sent yet."}</p>
          {lastVoucher && (
            <small className="help">
              Latest voucher synced: {new Date(lastVoucher).toLocaleTimeString()}
            </small>
          )}
        </div>
      </div>

      <div className="grid split">
        <div className="card">
          <div className="section-title">
            <h3>1. Onboard & Assign Roles</h3>
          </div>
          <small className="help">
            Admin-only: set KYC flag and assign borrower / coop / bank roles via KYCRegistry.
          </small>
          <OnboardForm disabled={!walletConnected} onSubmit={handleOnboard} />
        </div>
        <div className="card">
          <div className="section-title">
            <h3>2. Mint Animal Passport</h3>
          </div>
          <small className="help">
            Requires REGISTRAR_ROLE. Data feeds the AI scoring layer.
          </small>
          <PassportForm disabled={!walletConnected} onSubmit={handlePassport} />
        </div>
      </div>

      <div className="grid split">
        <div className="card">
          <div className="section-title">
            <h3>3. Cooperative Attestation</h3>
          </div>
          <CoopAttestationForm
            disabled={!walletConnected}
            onSubmit={handleAttestation}
          />
        </div>
        <div className="card">
          <div className="section-title">
            <h3>4. Grant Voucher + Guarantee Pool</h3>
          </div>
          <GrantVoucherForm disabled={!walletConnected} onSubmit={handleVoucher} />
          <hr style={{ margin: "24px 0" }} />
          <GrantDepositForm disabled={!walletConnected} onSubmit={handleGrantDeposit} />
        </div>
      </div>

      <div className="grid split">
        <AuthLog title="Livestock Owners" type="livestock" entries={logs.livestock} />
        <AuthLog title="Cooperatives" type="cooperative" entries={logs.cooperative} />
        <AuthLog title="Banks & LPs" type="bank" entries={logs.bank} />
      </div>
    </main>
  );
}
