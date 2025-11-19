import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function LoanRequestForm({ disabled, onSubmit }) {
    const [amount, setAmount] = useState("100000000");
    const [pending, setPending] = useState(false);
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!amount)
            return;
        setPending(true);
        try {
            await onSubmit({ amount });
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "loan-amount", children: "Loan amount (6 decimals)" }), _jsx("input", { id: "loan-amount", value: amount, onChange: (e) => setAmount(e.target.value) }), _jsx("small", { className: "help", children: "Matches the stable token decimals (example: 100000000 = 100 units)." }), _jsx("button", { type: "submit", disabled: pending || disabled || !amount, children: pending ? "Requesting…" : "Request Loan" })] }));
}
