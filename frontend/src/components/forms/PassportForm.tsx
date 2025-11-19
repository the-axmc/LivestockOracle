import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit(payload: {
    owner: string;
    speciesId: number;
    metadataHash: string;
  }): Promise<void>;
}

export function PassportForm({ disabled, onSubmit }: Props) {
  const [owner, setOwner] = useState("");
  const [speciesId, setSpeciesId] = useState(1);
  const [metadata, setMetadata] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner || !metadata) return;
    setPending(true);
    try {
      await onSubmit({ owner, speciesId, metadataHash: metadata });
      setOwner("");
      setMetadata("");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="passport-owner">Farmer wallet</label>
      <input
        id="passport-owner"
        placeholder="0x..."
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
      />

      <label htmlFor="passport-species">Species</label>
      <input
        type="number"
        min={1}
        id="passport-species"
        value={speciesId}
        onChange={(e) => setSpeciesId(Number(e.target.value))}
      />

      <label htmlFor="passport-metadata">Metadata hash</label>
      <input
        id="passport-metadata"
        placeholder="0x..."
        value={metadata}
        onChange={(e) => setMetadata(e.target.value)}
      />

      <button type="submit" disabled={pending || disabled || !owner || !metadata}>
        {pending ? "Minting…" : "Mint Passport"}
      </button>
    </form>
  );
}
