import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { formatUnits, stringToHex } from "viem";
import { useWallet } from "./hooks/useWallet";
import { publicClient, chain } from "./lib/client";
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
  const [creditSpeciesId, setCreditSpeciesId] = useState(1);
  const [metrics, setMetrics] = useState<{
    creditScore?: number;
    creditTimestamp?: number;
    creditValid?: boolean;
    healthFactor?: number;
    borrowable?: string;
  }>({});
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string>();

  const waitForTx = async (hash: Hex) => {
    setStatus("Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    setStatus("Confirmed block " + receipt.blockNumber);
    return receipt.transactionHash;
  };

  const ensureWallet = async () => {
    if (!wallet.address) throw new Error("Connect a wallet first");
    const signer = await wallet.getSigner();
    return { signer, account: wallet.address as Address };
  };

  const refreshMetrics = useCallback(async () => {
    if (!wallet.address) {
      setMetrics({});
      return;
    }
    setMetricsLoading(true);
    setMetricsError(undefined);
    try {
      const lendingAddr = requireAddress(contractAddresses.speciesLending, "SpeciesLending");
      const oracleAddr = requireAddress(contractAddresses.speciesOracle, "SpeciesOracle");
      const [healthRaw, borrowableRaw, scoreResult] = (await Promise.all([
        publicClient.readContract({
          address: lendingAddr,
          abi: speciesLendingAbi,
          functionName: "health",
          args: [wallet.address as Address]
        }),
        publicClient.readContract({
          address: lendingAddr,
          abi: speciesLendingAbi,
          functionName: "borrowable",
          args: [wallet.address as Address]
        }),
        publicClient.readContract({
          address: oracleAddr,
          abi: speciesOracleAbi,
          functionName: "currentScore",
          args: [BigInt(creditSpeciesId)]
        })
      ])) as [
        bigint,
        bigint,
        readonly [bigint, bigint, boolean]
      ];
      const [scoreValue, scoreTimestamp, scoreValid] = scoreResult;
      setMetrics({
        creditScore: Number(scoreValue),
        creditTimestamp: Number(scoreTimestamp),
        creditValid: Boolean(scoreValid),
        healthFactor: Number(formatUnits(healthRaw, 18)),
        borrowable: formatUnits(borrowableRaw, 6)
      });
    } catch (err) {
      console.error(err);
      setMetricsError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setMetricsLoading(false);
    }
  }, [wallet.address, creditSpeciesId]);

  useEffect(() => {
    if (wallet.address) {
      refreshMetrics();
    } else {
      setMetrics({});
    }
  }, [wallet.address, refreshMetrics]);

  const handleOnboard = async ({ target, type }: { target: string; type: ActorType }) => {
    const { signer, account } = await ensureWallet();
    const kycAddress = requireAddress(contractAddresses.kycRegistry, "KYCRegistry");
    const tx1 = await signer.writeContract({
      account,
      chain,
      address: kycAddress,
      abi: kycRegistryAbi,
      functionName: "setKYCStatus",
      args: [target as Address, true]
    });
    const txHash = await waitForTx(tx1);

    const [borrower, bank, coop, oracleBot, grantor] = roleMatrix[type];
    const tx2 = await signer.writeContract({
      account,
      chain,
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
    const { signer, account } = await ensureWallet();
    const speciesAddr = requireAddress(contractAddresses.speciesToken, "SpeciesToken");
    const tx = await signer.writeContract({
      account,
      chain,
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
    const { signer, account } = await ensureWallet();
    const passportAddr = requireAddress(contractAddresses.animalPassport, "AnimalPassportRegistry");
    const tx = await signer.writeContract({
      account,
      chain,
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
    const { signer, account } = await ensureWallet();
    const lendingAddr = requireAddress(contractAddresses.speciesLending, "SpeciesLending");
    const tx = await signer.writeContract({
      account,
      chain,
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
    const { signer, account } = await ensureWallet();
    const voucherAddr = requireAddress(contractAddresses.grantVoucher, "GrantVoucherRegistry");
    const payoutTs = Math.floor(new Date(payload.payoutDate).getTime() / 1000);
    const ref = payload.grantRef.startsWith("0x")
      ? (payload.grantRef as Hex)
      : (stringToHex(payload.grantRef, { size: 32 }) as Hex);
    const tx = await signer.writeContract({
      account,
      chain,
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
    const { signer, account } = await ensureWallet();
    const coopAddr = requireAddress(contractAddresses.cooperativeAttestor, "CooperativeAttestor");
    const tx = await signer.writeContract({
      account,
      chain,
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
    const { signer, account } = await ensureWallet();
    const oracleAddr = requireAddress(contractAddresses.speciesOracle, "SpeciesOracle");
    const tx = await signer.writeContract({
      account,
      chain,
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
    const { signer, account } = await ensureWallet();
    const guaranteeAddr = requireAddress(contractAddresses.guaranteePool, "GuaranteePool");
    const tx = await signer.writeContract({
      account,
      chain,
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

  const creditLastUpdated = metrics.creditTimestamp
    ? new Date(metrics.creditTimestamp * 1000).toLocaleString()
    : "—";
  const healthDisplay =
    typeof metrics.healthFactor === "number" ? metrics.healthFactor.toFixed(2) : "—";
  const borrowableDisplay = metrics.borrowable ? `${metrics.borrowable}` : "—";
  const creditScoreDisplay =
    metrics.creditScore !== undefined ? metrics.creditScore.toString() : "—";
  const creditStatus =
    metrics.creditValid === undefined ? "Unknown" : metrics.creditValid ? "Fresh" : "Stale";

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
        <div className="grid split">
          <div className="card">
            <div className="section-title">
              <h3>Credit score (SpeciesOracle)</h3>
            </div>
            <small className="help">
              Pull the latest AI score for your herd to share with lenders or co-ops.
            </small>
            <label htmlFor="credit-species-id">Species ID</label>
            <input
              id="credit-species-id"
              type="number"
              min={1}
              value={creditSpeciesId}
              disabled={!walletConnected}
              onChange={(e) => setCreditSpeciesId(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={refreshMetrics}
              disabled={!walletConnected || metricsLoading}
            >
              {metricsLoading ? "Refreshing…" : "Refresh metrics"}
            </button>
            {metricsError && (
              <small className="help" style={{ color: "#dc2626" }}>
                {metricsError}
              </small>
            )}
            <div style={{ marginTop: 16 }}>
              <p>
                <strong>Score:</strong> {creditScoreDisplay}
              </p>
              <p>
                <strong>Status:</strong> {creditStatus}
              </p>
              <p>
                <strong>Last updated:</strong> {creditLastUpdated}
              </p>
            </div>
          </div>
          <div className="card">
            <div className="section-title">
              <h3>Borrower health snapshot</h3>
            </div>
            <small className="help">
              This mirrors what cooperatives review before approving deliveries.
            </small>
            <p>
              <strong>Health factor:</strong> {healthDisplay}
            </p>
            <p>
              <strong>Borrowable balance:</strong>{" "}
              {borrowableDisplay === "—" ? "—" : `${borrowableDisplay} stable`}
            </p>
            <small className="help">
              Health ≥ 1.0 means you&apos;re safe. Refresh after each deposit or pledge
              to keep your cooperative in sync.
            </small>
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
