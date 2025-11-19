import { useMemo, useState } from "react";
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
  guaranteePoolAbi,
  speciesTokenAbi,
  speciesLendingAbi,
  speciesOracleAbi
} from "./lib/abis";
import { WalletCard } from "./components/WalletCard";
import { AuthLog } from "./components/AuthLog";
import { useAuthLogs } from "./state/useAuthLogs";
import { OnboardForm } from "./components/forms/OnboardForm";
import { PassportForm } from "./components/forms/PassportForm";
import { GrantVoucherForm } from "./components/forms/GrantVoucherForm";
import { CoopAttestationForm } from "./components/forms/CoopAttestationForm";
import { GrantDepositForm } from "./components/forms/GrantDepositForm";
import { SpeciesConfigForm } from "./components/forms/SpeciesConfigForm";
import { LoanRequestForm } from "./components/forms/LoanRequestForm";
import { CreditScoreForm } from "./components/forms/CreditScoreForm";
import { CowExample } from "./components/CowExample";
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

  const handleSpeciesConfig = async (payload: {
    speciesId: number;
    name: string;
    unitDecimals: number;
    mintPaused: boolean;
  }) => {
    const signer = await ensureWallet();
    const speciesAddr = requireAddress(contractAddresses.speciesToken, "SpeciesToken");
    const tx = await signer.writeContract({
      address: speciesAddr,
      abi: speciesTokenAbi,
      functionName: "setSpeciesInfo",
      args: [BigInt(payload.speciesId), payload.name, payload.unitDecimals, payload.mintPaused]
    });
    const txHash = await waitForTx(tx);
    pushLog("livestock", {
      actor: wallet.address || "",
      action: "Species configured",
      details: `${payload.name} (ID ${payload.speciesId})`,
      txHash,
      timestamp: Date.now()
    });
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

  const handleLoanRequest = async ({ amount }: { amount: string }) => {
    const signer = await ensureWallet();
    const lendingAddr = requireAddress(contractAddresses.speciesLending, "SpeciesLending");
    const tx = await signer.writeContract({
      address: lendingAddr,
      abi: speciesLendingAbi,
      functionName: "borrow",
      args: [BigInt(amount || "0")]
    });
    const txHash = await waitForTx(tx);
    pushLog("livestock", {
      actor: wallet.address || "",
      action: "Loan requested",
      details: `${amount} stable units`,
      txHash,
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

  const handleCreditScore = async (payload: {
    speciesId: number;
    price: string;
    score: number;
  }) => {
    const signer = await ensureWallet();
    const oracleAddr = requireAddress(contractAddresses.speciesOracle, "SpeciesOracle");
    const tx = await signer.writeContract({
      address: oracleAddr,
      abi: speciesOracleAbi,
      functionName: "postPriceWithScore",
      args: [BigInt(payload.speciesId), BigInt(payload.price || "0"), BigInt(payload.score)]
    });
    const txHash = await waitForTx(tx);
    pushLog("cooperative", {
      actor: wallet.address || "",
      action: "Credit score posted",
      details: `Species ${payload.speciesId} • score ${payload.score}`,
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

  const cowScenario = useMemo(() => {
    const metadataNote = "cow-001";
    const payoutDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      .toISOString()
      .slice(0, 10);
    return {
      speciesId: 1,
      speciesName: "Nguni Cow",
      unitDecimals: 0,
      metadataNote,
      metadataHash: stringToHex(metadataNote, { size: 32 }) as Hex,
      loanAmount: "100000000",
      price: "150000000000",
      score: 780,
      grantAmount: "100000000",
      grantRef: "cow-001-voucher",
      payoutDate
    };
  }, []);

  return (
    <main className="grid" style={{ gap: "32px" }}>
      <header className="card" style={{ textAlign: "left" }}>
        <h1>Livestock Oracle Control Center</h1>
        <p>
          Every form below is mapped to the on-chain modules so you can walk a cow from
          onboarding to an underwritten, credit-scored loan request.
        </p>
        <p>
          <small>
            RPC: {contractAddresses.kycRegistry ? "configured" : "missing"} • Total auth
            events tracked: {stats.total}
          </small>
        </p>
      </header>

      <section className="grid" style={{ gap: "16px" }}>
        <div className="section-title">
          <span className="badge">1. Livestock owners</span>
          <h2>Farmer onboarding & requests</h2>
        </div>
        <small className="help">
          KYC their wallet, configure the species catalog, mint passports, and submit loan
          asks using SpeciesLending.
        </small>
        <div className="grid split">
          <div className="card">
            <div className="section-title">
              <h3>Onboard & assign roles</h3>
            </div>
            <OnboardForm disabled={!walletConnected} onSubmit={handleOnboard} />
          </div>
          <div className="card">
            <div className="section-title">
              <h3>Create / update species</h3>
            </div>
            <small className="help">
              Writes to SpeciesToken.setSpeciesInfo so Cow, Goat, Pig… IDs stay in sync.
            </small>
            <SpeciesConfigForm disabled={!walletConnected} onSubmit={handleSpeciesConfig} />
          </div>
        </div>
        <div className="grid split">
          <div className="card">
            <div className="section-title">
              <h3>Mint animal passport</h3>
            </div>
            <PassportForm disabled={!walletConnected} onSubmit={handlePassport} />
          </div>
          <div className="card">
            <div className="section-title">
              <h3>Request a loan</h3>
            </div>
            <small className="help">
              Calls SpeciesLending.borrow after collateral is deposited / approved.
            </small>
            <LoanRequestForm disabled={!walletConnected} onSubmit={handleLoanRequest} />
          </div>
        </div>
      </section>

      <section className="grid" style={{ gap: "16px" }}>
        <div className="section-title">
          <span className="badge">2. Cooperatives</span>
          <h2>Field data & credit signals</h2>
        </div>
        <small className="help">
          Capture deliveries / membership plus AI credit scores piped through the oracle.
        </small>
        <div className="grid split">
          <div className="card">
            <div className="section-title">
              <h3>Membership attestation</h3>
            </div>
            <CoopAttestationForm disabled={!walletConnected} onSubmit={handleAttestation} />
          </div>
          <div className="card">
            <div className="section-title">
              <h3>Publish credit score</h3>
            </div>
            <CreditScoreForm disabled={!walletConnected} onSubmit={handleCreditScore} />
          </div>
        </div>
      </section>

      <section className="grid" style={{ gap: "16px" }}>
        <div className="section-title">
          <span className="badge">3. Dashboard</span>
          <h2>Live control tower</h2>
        </div>
        <small className="help">
          Wallet connectivity, status, guided cow example, and categorized auth feeds.
        </small>
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
              <h3>Live status</h3>
            </div>
            <p>{status || "No transactions sent yet."}</p>
            {lastVoucher && (
              <small className="help">
                Latest voucher synced: {new Date(lastVoucher).toLocaleTimeString()}
              </small>
            )}
          </div>
        </div>
        <CowExample
          disabled={!walletConnected}
          owner={wallet.address}
          scenario={cowScenario}
          actions={{
            createSpecies: () =>
              handleSpeciesConfig({
                speciesId: cowScenario.speciesId,
                name: cowScenario.speciesName,
                unitDecimals: cowScenario.unitDecimals,
                mintPaused: false
              }),
            mintPassport: () =>
              handlePassport({
                owner: wallet.address || "",
                speciesId: cowScenario.speciesId,
                metadataHash: cowScenario.metadataHash
              }),
            requestLoan: () => handleLoanRequest({ amount: cowScenario.loanAmount }),
            postCreditScore: () =>
              handleCreditScore({
                speciesId: cowScenario.speciesId,
                price: cowScenario.price,
                score: cowScenario.score
              }),
            fundLoan: () =>
              handleVoucher({
                beneficiary: wallet.address || "",
                amount: cowScenario.grantAmount,
                payoutDate: cowScenario.payoutDate,
                grantRef: cowScenario.grantRef
              })
          }}
        />
        <div className="grid split">
          <AuthLog title="Livestock owners" type="livestock" entries={logs.livestock} />
          <AuthLog title="Cooperatives" type="cooperative" entries={logs.cooperative} />
          <AuthLog title="Liquidity Providers" type="bank" entries={logs.bank} />
        </div>
      </section>

      <section className="grid" style={{ gap: "16px" }}>
        <div className="section-title">
          <span className="badge">4. Liquidity providers</span>
          <h2>Grant vouchers & guarantee pool</h2>
        </div>
        <small className="help">
          Issue grant-backed loans (NFT vouchers) and top up the loss-absorbing pool.
        </small>
        <div className="grid split">
          <div className="card">
            <div className="section-title">
              <h3>Mint grant voucher</h3>
            </div>
            <GrantVoucherForm disabled={!walletConnected} onSubmit={handleVoucher} />
          </div>
          <div className="card">
            <div className="section-title">
              <h3>Deposit to guarantee pool</h3>
            </div>
            <GrantDepositForm disabled={!walletConnected} onSubmit={handleGrantDeposit} />
          </div>
        </div>
      </section>
    </main>
  );
}
