import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function GrantVoucherForm({ disabled, onSubmit }) {
    const [beneficiary, setBeneficiary] = useState("");
    const [amount, setAmount] = useState("0");
    const [payoutDate, setPayoutDate] = useState("");
    const [grantRef, setGrantRef] = useState("grant-001");
    const [pending, setPending] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!beneficiary || !payoutDate)
            return;
        setPending(true);
        try {
            await onSubmit({ beneficiary, amount, payoutDate, grantRef });
            setBeneficiary("");
            setAmount("0");
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "voucher-beneficiary", children: "Beneficiary" }), _jsx("input", { id: "voucher-beneficiary", value: beneficiary, onChange: (e) => setBeneficiary(e.target.value), placeholder: "0x..." }), _jsx("label", { htmlFor: "voucher-amount", children: "Amount (wei)" }), _jsx("input", { id: "voucher-amount", value: amount, onChange: (e) => setAmount(e.target.value) }), _jsx("label", { htmlFor: "voucher-date", children: "Expected payout date" }), _jsx("input", { type: "date", id: "voucher-date", value: payoutDate, onChange: (e) => setPayoutDate(e.target.value) }), _jsx("label", { htmlFor: "voucher-ref", children: "Grant reference" }), _jsx("input", { id: "voucher-ref", value: grantRef, onChange: (e) => setGrantRef(e.target.value) }), _jsx("button", { type: "submit", disabled: pending || disabled || !beneficiary || !payoutDate, children: pending ? "Minting…" : "Issue Voucher" })] }));
}
