import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function GrantDepositForm({ disabled, onSubmit }) {
    const [amount, setAmount] = useState("0");
    const [pending, setPending] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setPending(true);
        try {
            await onSubmit({ amount });
            setAmount("0");
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "grant-amount", children: "Grant amount (wei)" }), _jsx("input", { id: "grant-amount", value: amount, onChange: (e) => setAmount(e.target.value) }), _jsx("button", { type: "submit", disabled: pending || disabled, children: pending ? "Depositing…" : "Deposit" })] }));
}
