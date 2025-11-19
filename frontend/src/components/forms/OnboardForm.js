import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const labels = {
    livestock: "Livestock Owner",
    cooperative: "Cooperative",
    bank: "Bank / LP"
};
export function OnboardForm({ disabled, onSubmit }) {
    const [target, setTarget] = useState("");
    const [type, setType] = useState("livestock");
    const [pending, setPending] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (pending || !target)
            return;
        setPending(true);
        try {
            await onSubmit({ target, type });
            setTarget("");
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "onboard-address", children: "Wallet address" }), _jsx("input", { id: "onboard-address", placeholder: "0x...", value: target, onChange: (e) => setTarget(e.target.value) }), _jsx("label", { htmlFor: "onboard-type", children: "Actor category" }), _jsx("select", { id: "onboard-type", value: type, onChange: (e) => setType(e.target.value), children: Object.entries(labels).map(([value, label]) => (_jsx("option", { value: value, children: label }, value))) }), _jsx("button", { type: "submit", disabled: pending || disabled || !target, children: pending ? "Onboarding…" : `Approve ${labels[type]}` })] }));
}
