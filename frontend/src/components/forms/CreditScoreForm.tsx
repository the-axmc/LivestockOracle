import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit(payload: {
    speciesId: number;
    price: string;
    score: number;
  }): Promise<void>;
}

export function CreditScoreForm({ disabled, onSubmit }: Props) {
  const [speciesId, setSpeciesId] = useState(1);
  const [price, setPrice] = useState("150000000000");
  const [score, setScore] = useState(780);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!price) return;
    setPending(true);
    try {
      await onSubmit({ speciesId, price, score });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="credit-species">Species ID</label>
      <input
        id="credit-species"
        type="number"
        min={1}
        value={speciesId}
        onChange={(e) => setSpeciesId(Number(e.target.value))}
      />

      <label htmlFor="credit-price">Price feed (USD * 1e8)</label>
      <input
        id="credit-price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />

      <label htmlFor="credit-score">Credit score (0-1000)</label>
      <input
        id="credit-score"
        type="number"
        min={0}
        max={1000}
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
      />

      <button type="submit" disabled={pending || disabled || !price}>
        {pending ? "Posting…" : "Publish Score"}
      </button>
    </form>
  );
}
