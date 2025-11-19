import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { stringToHex } from "viem";
import { useWallet } from "./hooks/useWallet";
import { publicClient } from "./lib/client";
import { contractAddresses } from "./config/contracts";
import { kycRegistryAbi, animalPassportAbi, cooperativeAttestorAbi, grantVoucherAbi, guaranteePoolAbi, speciesTokenAbi, speciesLendingAbi, speciesOracleAbi } from "./lib/abis";
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
const roleMatrix = {
    livestock: [true, false, false, false, false],
    cooperative: [false, false, true, false, false],
    bank: [false, true, false, false, false]
};
function requireAddress(addr, name) {
    if (!addr)
        throw new Error(`${name || "address"} is not configured`);
    return addr;
}
export default function App() {
    const wallet = useWallet();
    const { logs, pushLog, stats } = useAuthLogs();
    const [status, setStatus] = useState("");
    const [lastVoucher, setLastVoucher] = useState();
    const waitForTx = async (hash) => {
        setStatus("Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setStatus("Confirmed block " + receipt.blockNumber);
        return receipt.transactionHash;
    };
    const ensureWallet = async () => {
        if (!wallet.address)
            throw new Error("Connect a wallet first");
        return wallet.getSigner();
    };
    const handleOnboard = async ({ target, type }) => {
        const signer = await ensureWallet();
        const kycAddress = requireAddress(contractAddresses.kycRegistry, "KYCRegistry");
        const tx1 = await signer.writeContract({
            address: kycAddress,
            abi: kycRegistryAbi,
            functionName: "setKYCStatus",
            args: [target, true]
        });
        const txHash = await waitForTx(tx1);
        const [borrower, bank, coop, oracleBot, grantor] = roleMatrix[type];
        const tx2 = await signer.writeContract({
            address: kycAddress,
            abi: kycRegistryAbi,
            functionName: "setUserRoles",
            args: [target, borrower, bank, coop, oracleBot, grantor]
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
    const handleSpeciesConfig = async (payload) => {
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
    const handlePassport = async (payload) => {
        const signer = await ensureWallet();
        const passportAddr = requireAddress(contractAddresses.animalPassport, "AnimalPassportRegistry");
        const tx = await signer.writeContract({
            address: passportAddr,
            abi: animalPassportAbi,
            functionName: "mintPassport",
            args: [payload.owner, BigInt(payload.speciesId), payload.metadataHash]
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
    const handleLoanRequest = async ({ amount }) => {
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
    const handleVoucher = async (payload) => {
        const signer = await ensureWallet();
        const voucherAddr = requireAddress(contractAddresses.grantVoucher, "GrantVoucherRegistry");
        const payoutTs = Math.floor(new Date(payload.payoutDate).getTime() / 1000);
        const ref = payload.grantRef.startsWith("0x")
            ? payload.grantRef
            : stringToHex(payload.grantRef, { size: 32 });
        const tx = await signer.writeContract({
            address: voucherAddr,
            abi: grantVoucherAbi,
            functionName: "mintVoucher",
            args: [
                payload.beneficiary,
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
    const handleAttestation = async (payload) => {
        const signer = await ensureWallet();
        const coopAddr = requireAddress(contractAddresses.cooperativeAttestor, "CooperativeAttestor");
        const tx = await signer.writeContract({
            address: coopAddr,
            abi: cooperativeAttestorAbi,
            functionName: "setMembership",
            args: [
                payload.farmer,
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
    const handleCreditScore = async (payload) => {
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
    const handleGrantDeposit = async ({ amount }) => {
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
            metadataHash: stringToHex(metadataNote, { size: 32 }),
            loanAmount: "100000000",
            price: "150000000000",
            score: 780,
            grantAmount: "100000000",
            grantRef: "cow-001-voucher",
            payoutDate
        };
    }, []);
    return (_jsxs("main", { className: "grid", style: { gap: "32px" }, children: [_jsxs("header", { className: "card", style: { textAlign: "left" }, children: [_jsx("h1", { children: "Livestock Oracle Control Center" }), _jsx("p", { children: "Every form below is mapped to the on-chain modules so you can walk a cow from onboarding to an underwritten, credit-scored loan request." }), _jsx("p", { children: _jsxs("small", { children: ["RPC: ", contractAddresses.kycRegistry ? "configured" : "missing", " \u2022 Total auth events tracked: ", stats.total] }) })] }), _jsxs("section", { className: "grid", style: { gap: "16px" }, children: [_jsxs("div", { className: "section-title", children: [_jsx("span", { className: "badge", children: "1. Livestock owners" }), _jsx("h2", { children: "Farmer onboarding & requests" })] }), _jsx("small", { className: "help", children: "KYC their wallet, configure the species catalog, mint passports, and submit loan asks using SpeciesLending." }), _jsxs("div", { className: "grid split", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Onboard & assign roles" }) }), _jsx(OnboardForm, { disabled: !walletConnected, onSubmit: handleOnboard })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Create / update species" }) }), _jsx("small", { className: "help", children: "Writes to SpeciesToken.setSpeciesInfo so Cow, Goat, Pig\u2026 IDs stay in sync." }), _jsx(SpeciesConfigForm, { disabled: !walletConnected, onSubmit: handleSpeciesConfig })] })] }), _jsxs("div", { className: "grid split", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Mint animal passport" }) }), _jsx(PassportForm, { disabled: !walletConnected, onSubmit: handlePassport })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Request a loan" }) }), _jsx("small", { className: "help", children: "Calls SpeciesLending.borrow after collateral is deposited / approved." }), _jsx(LoanRequestForm, { disabled: !walletConnected, onSubmit: handleLoanRequest })] })] })] }), _jsxs("section", { className: "grid", style: { gap: "16px" }, children: [_jsxs("div", { className: "section-title", children: [_jsx("span", { className: "badge", children: "2. Cooperatives" }), _jsx("h2", { children: "Field data & credit signals" })] }), _jsx("small", { className: "help", children: "Capture deliveries / membership plus AI credit scores piped through the oracle." }), _jsxs("div", { className: "grid split", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Membership attestation" }) }), _jsx(CoopAttestationForm, { disabled: !walletConnected, onSubmit: handleAttestation })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Publish credit score" }) }), _jsx(CreditScoreForm, { disabled: !walletConnected, onSubmit: handleCreditScore })] })] })] }), _jsxs("section", { className: "grid", style: { gap: "16px" }, children: [_jsxs("div", { className: "section-title", children: [_jsx("span", { className: "badge", children: "3. Dashboard" }), _jsx("h2", { children: "Live control tower" })] }), _jsx("small", { className: "help", children: "Wallet connectivity, status, guided cow example, and categorized auth feeds." }), _jsxs("div", { className: "grid split", children: [_jsx(WalletCard, { address: wallet.address, chainId: wallet.chainId, connect: wallet.connect, disconnect: wallet.disconnect, connecting: wallet.connecting }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Live status" }) }), _jsx("p", { children: status || "No transactions sent yet." }), lastVoucher && (_jsxs("small", { className: "help", children: ["Latest voucher synced: ", new Date(lastVoucher).toLocaleTimeString()] }))] })] }), _jsx(CowExample, { disabled: !walletConnected, owner: wallet.address, scenario: cowScenario, actions: {
                            createSpecies: () => handleSpeciesConfig({
                                speciesId: cowScenario.speciesId,
                                name: cowScenario.speciesName,
                                unitDecimals: cowScenario.unitDecimals,
                                mintPaused: false
                            }),
                            mintPassport: () => handlePassport({
                                owner: wallet.address || "",
                                speciesId: cowScenario.speciesId,
                                metadataHash: cowScenario.metadataHash
                            }),
                            requestLoan: () => handleLoanRequest({ amount: cowScenario.loanAmount }),
                            postCreditScore: () => handleCreditScore({
                                speciesId: cowScenario.speciesId,
                                price: cowScenario.price,
                                score: cowScenario.score
                            }),
                            fundLoan: () => handleVoucher({
                                beneficiary: wallet.address || "",
                                amount: cowScenario.grantAmount,
                                payoutDate: cowScenario.payoutDate,
                                grantRef: cowScenario.grantRef
                            })
                        } }), _jsxs("div", { className: "grid split", children: [_jsx(AuthLog, { title: "Livestock owners", type: "livestock", entries: logs.livestock }), _jsx(AuthLog, { title: "Cooperatives", type: "cooperative", entries: logs.cooperative }), _jsx(AuthLog, { title: "Liquidity Providers", type: "bank", entries: logs.bank })] })] }), _jsxs("section", { className: "grid", style: { gap: "16px" }, children: [_jsxs("div", { className: "section-title", children: [_jsx("span", { className: "badge", children: "4. Liquidity providers" }), _jsx("h2", { children: "Grant vouchers & guarantee pool" })] }), _jsx("small", { className: "help", children: "Issue grant-backed loans (NFT vouchers) and top up the loss-absorbing pool." }), _jsxs("div", { className: "grid split", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Mint grant voucher" }) }), _jsx(GrantVoucherForm, { disabled: !walletConnected, onSubmit: handleVoucher })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Deposit to guarantee pool" }) }), _jsx(GrantDepositForm, { disabled: !walletConnected, onSubmit: handleGrantDeposit })] })] })] })] }));
}
