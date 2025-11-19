import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function SpeciesConfigForm({ disabled, onSubmit }) {
    const [speciesId, setSpeciesId] = useState(1);
    const [name, setName] = useState("Cow");
    const [unitDecimals, setUnitDecimals] = useState(0);
    const [mintPaused, setMintPaused] = useState(false);
    const [pending, setPending] = useState(false);
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!name)
            return;
        setPending(true);
        try {
            await onSubmit({ speciesId, name, unitDecimals, mintPaused });
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "species-id", children: "Species ID" }), _jsx("input", { id: "species-id", type: "number", min: 1, value: speciesId, onChange: (e) => setSpeciesId(Number(e.target.value)) }), _jsx("label", { htmlFor: "species-name", children: "Display name" }), _jsx("input", { id: "species-name", value: name, onChange: (e) => setName(e.target.value) }), _jsx("label", { htmlFor: "species-unit-decimals", children: "Unit decimals" }), _jsx("input", { id: "species-unit-decimals", type: "number", min: 0, max: 18, value: unitDecimals, onChange: (e) => setUnitDecimals(Number(e.target.value)) }), _jsx("label", { htmlFor: "species-paused", children: "Minting status" }), _jsxs("select", { id: "species-paused", value: String(mintPaused), onChange: (e) => setMintPaused(e.target.value === "true"), children: [_jsx("option", { value: "false", children: "Active" }), _jsx("option", { value: "true", children: "Paused" })] }), _jsx("button", { type: "submit", disabled: pending || disabled || !name, children: pending ? "Saving…" : "Save Species" })] }));
}
