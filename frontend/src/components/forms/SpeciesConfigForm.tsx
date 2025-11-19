import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit(payload: {
    speciesId: number;
    name: string;
    unitDecimals: number;
    mintPaused: boolean;
  }): Promise<void>;
}

export function SpeciesConfigForm({ disabled, onSubmit }: Props) {
  const [speciesId, setSpeciesId] = useState(1);
  const [name, setName] = useState("Cow");
  const [unitDecimals, setUnitDecimals] = useState(0);
  const [mintPaused, setMintPaused] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name) return;
    setPending(true);
    try {
      await onSubmit({ speciesId, name, unitDecimals, mintPaused });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="species-id">Species ID</label>
      <input
        id="species-id"
        type="number"
        min={1}
        value={speciesId}
        onChange={(e) => setSpeciesId(Number(e.target.value))}
      />

      <label htmlFor="species-name">Display name</label>
      <input
        id="species-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label htmlFor="species-unit-decimals">Unit decimals</label>
      <input
        id="species-unit-decimals"
        type="number"
        min={0}
        max={18}
        value={unitDecimals}
        onChange={(e) => setUnitDecimals(Number(e.target.value))}
      />

      <label htmlFor="species-paused">Minting status</label>
      <select
        id="species-paused"
        value={String(mintPaused)}
        onChange={(e) => setMintPaused(e.target.value === "true")}
      >
        <option value="false">Active</option>
        <option value="true">Paused</option>
      </select>

      <button type="submit" disabled={pending || disabled || !name}>
        {pending ? "Saving…" : "Save Species"}
      </button>
    </form>
  );
}
