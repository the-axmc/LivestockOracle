import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { truncateAddress } from "../utils/format";
const initialStatus = {
    species: "idle",
    passport: "idle",
    loan: "idle",
    score: "idle",
    fund: "idle"
};
export function CowExample({ disabled, owner, scenario, actions }) {
    const [status, setStatus] = useState(initialStatus);
    const steps = useMemo(() => [
        {
            id: "species",
            title: "Create species",
            detail: `ID ${scenario.speciesId} • ${scenario.speciesName}`,
            action: actions.createSpecies
        },
        {
            id: "passport",
            title: "Mint passport",
            detail: `Owner ${owner ? truncateAddress(owner) : "connect wallet"} • note ${scenario.metadataNote}`,
            action: actions.mintPassport
        },
        {
            id: "loan",
            title: "Request loan",
            detail: `Borrow ${scenario.loanAmount} units (6 decimals)`,
            action: actions.requestLoan
        },
        {
            id: "score",
            title: "Define credit score",
            detail: `Price ${scenario.price} • score ${scenario.score}`,
            action: actions.postCreditScore
        },
        {
            id: "fund",
            title: "Give the loan",
            detail: `Voucher ${scenario.grantRef} • ${scenario.grantAmount} due ${scenario.payoutDate}`,
            action: actions.fundLoan
        }
    ], [actions, owner, scenario]);
    const runStep = async (step) => {
        setStatus((prev) => ({ ...prev, [step.id]: "pending" }));
        try {
            await step.action();
            setStatus((prev) => ({ ...prev, [step.id]: "done" }));
        }
        catch (err) {
            console.error(err);
            setStatus((prev) => ({ ...prev, [step.id]: "error" }));
        }
    };
    const chipColor = (value) => {
        switch (value) {
            case "done":
                return "#16a34a";
            case "pending":
                return "#f59e0b";
            case "error":
                return "#dc2626";
            default:
                return "#475569";
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Cow example walkthrough" }) }), _jsx("small", { className: "help", children: "One-click flow that touches every contract: species setup, passport mint, loan request, credit score, and grant disbursement." }), _jsx("div", { className: "grid", style: { marginTop: 16 }, children: steps.map((step) => (_jsxs("div", { style: {
                        border: "1px solid rgba(15,23,42,0.08)",
                        borderRadius: 12,
                        padding: 16,
                        background: "rgba(148, 163, 184, 0.08)"
                    }, children: [_jsxs("div", { className: "section-title", style: { marginBottom: 4 }, children: [_jsx("span", { className: "badge", style: { background: "transparent", color: chipColor(status[step.id]) }, children: status[step.id] === "done"
                                        ? "Complete"
                                        : status[step.id] === "pending"
                                            ? "Pending"
                                            : status[step.id] === "error"
                                                ? "Error"
                                                : "Ready" }), _jsx("h3", { style: { fontSize: "1rem" }, children: step.title })] }), _jsx("p", { style: { marginTop: 0, color: "#475569" }, children: step.detail }), _jsx("button", { onClick: () => runStep(step), disabled: disabled || status[step.id] === "pending", style: { width: "100%" }, children: status[step.id] === "pending" ? "Processing…" : "Run step" })] }, step.id))) })] }));
}
