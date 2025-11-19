import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit(payload: {
    farmer: string;
    active: boolean;
    deliveries: number;
    goodStanding: boolean;
    rating: number;
  }): Promise<void>;
}

export function CoopAttestationForm({ disabled, onSubmit }: Props) {
  const [farmer, setFarmer] = useState("");
  const [active, setActive] = useState(true);
  const [deliveries, setDeliveries] = useState(0);
  const [goodStanding, setGoodStanding] = useState(true);
  const [rating, setRating] = useState(80);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmer) return;
    setPending(true);
    try {
      await onSubmit({ farmer, active, deliveries, goodStanding, rating });
      setFarmer("");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="coop-farmer">Farmer wallet</label>
      <input
        id="coop-farmer"
        value={farmer}
        onChange={(e) => setFarmer(e.target.value)}
      />

      <label htmlFor="coop-active">Membership status</label>
      <select
        id="coop-active"
        value={String(active)}
        onChange={(e) => setActive(e.target.value === "true")}
      >
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>

      <label htmlFor="coop-deliveries">Deliveries (last 6 months)</label>
      <input
        type="number"
        id="coop-deliveries"
        value={deliveries}
        onChange={(e) => setDeliveries(Number(e.target.value))}
      />

      <label htmlFor="coop-standing">Good standing?</label>
      <select
        id="coop-standing"
        value={String(goodStanding)}
        onChange={(e) => setGoodStanding(e.target.value === "true")}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>

      <label htmlFor="coop-rating">Rating (0-100)</label>
      <input
        type="number"
        min={0}
        max={100}
        id="coop-rating"
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
      />

      <button type="submit" disabled={pending || disabled || !farmer}>
        {pending ? "Submitting…" : "Submit Attestation"}
      </button>
    </form>
  );
}
