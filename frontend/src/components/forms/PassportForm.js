import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function PassportForm({ disabled, onSubmit }) {
    const [owner, setOwner] = useState("");
    const [speciesId, setSpeciesId] = useState(1);
    const [metadata, setMetadata] = useState("");
    const [pending, setPending] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!owner || !metadata)
            return;
        setPending(true);
        try {
            await onSubmit({ owner, speciesId, metadataHash: metadata });
            setOwner("");
            setMetadata("");
        }
        finally {
            setPending(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "passport-owner", children: "Farmer wallet" }), _jsx("input", { id: "passport-owner", placeholder: "0x...", value: owner, onChange: (e) => setOwner(e.target.value) }), _jsx("label", { htmlFor: "passport-species", children: "Species" }), _jsx("input", { type: "number", min: 1, id: "passport-species", value: speciesId, onChange: (e) => setSpeciesId(Number(e.target.value)) }), _jsx("label", { htmlFor: "passport-metadata", children: "Metadata hash" }), _jsx("input", { id: "passport-metadata", placeholder: "0x...", value: metadata, onChange: (e) => setMetadata(e.target.value) }), _jsx("button", { type: "submit", disabled: pending || disabled || !owner || !metadata, children: pending ? "Minting…" : "Mint Passport" })] }));
}
