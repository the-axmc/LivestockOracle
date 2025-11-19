import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function CoopAttestationForm({ disabled, onSubmit }) {
    const [farmer, setFarmer] = useState("");
    const [active, setActive] = useState(true);
    const [deliveries, setDeliveries] = useState(0);
    const [goodStanding, setGoodStanding] = useState(true);
    const [rating, setRating] = useState(80);
    const [pending, setPending] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!farmer)
            return;
        setPending(true);
        try {
            await onSubmit({ farmer, active, deliveries, goodStanding, rating });
            setFarmer("");
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "coop-farmer", children: "Farmer wallet" }), _jsx("input", { id: "coop-farmer", value: farmer, onChange: (e) => setFarmer(e.target.value) }), _jsx("label", { htmlFor: "coop-active", children: "Membership status" }), _jsxs("select", { id: "coop-active", value: String(active), onChange: (e) => setActive(e.target.value === "true"), children: [_jsx("option", { value: "true", children: "Active" }), _jsx("option", { value: "false", children: "Inactive" })] }), _jsx("label", { htmlFor: "coop-deliveries", children: "Deliveries (last 6 months)" }), _jsx("input", { type: "number", id: "coop-deliveries", value: deliveries, onChange: (e) => setDeliveries(Number(e.target.value)) }), _jsx("label", { htmlFor: "coop-standing", children: "Good standing?" }), _jsxs("select", { id: "coop-standing", value: String(goodStanding), onChange: (e) => setGoodStanding(e.target.value === "true"), children: [_jsx("option", { value: "true", children: "Yes" }), _jsx("option", { value: "false", children: "No" })] }), _jsx("label", { htmlFor: "coop-rating", children: "Rating (0-100)" }), _jsx("input", { type: "number", min: 0, max: 100, id: "coop-rating", value: rating, onChange: (e) => setRating(Number(e.target.value)) }), _jsx("button", { type: "submit", disabled: pending || disabled || !farmer, children: pending ? "Submitting…" : "Submit Attestation" })] }));
}
