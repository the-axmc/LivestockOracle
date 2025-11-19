import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function CreditScoreForm({ disabled, onSubmit }) {
    const [speciesId, setSpeciesId] = useState(1);
    const [price, setPrice] = useState("150000000000");
    const [score, setScore] = useState(780);
    const [pending, setPending] = useState(false);
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!price)
            return;
        setPending(true);
        try {
            await onSubmit({ speciesId, price, score });
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "credit-species", children: "Species ID" }), _jsx("input", { id: "credit-species", type: "number", min: 1, value: speciesId, onChange: (e) => setSpeciesId(Number(e.target.value)) }), _jsx("label", { htmlFor: "credit-price", children: "Price feed (USD * 1e8)" }), _jsx("input", { id: "credit-price", value: price, onChange: (e) => setPrice(e.target.value) }), _jsx("label", { htmlFor: "credit-score", children: "Credit score (0-1000)" }), _jsx("input", { id: "credit-score", type: "number", min: 0, max: 1000, value: score, onChange: (e) => setScore(Number(e.target.value)) }), _jsx("button", { type: "submit", disabled: pending || disabled || !price, children: pending ? "Posting…" : "Publish Score" })] }));
}
