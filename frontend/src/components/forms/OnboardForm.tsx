import { useState } from "react";
import type { ActorType } from "../../types";

interface Props {
  disabled?: boolean;
  onSubmit(payload: { target: string; type: ActorType }): Promise<void>;
}

const labels: Record<ActorType, string> = {
  livestock: "Livestock Owner",
  cooperative: "Cooperative",
  bank: "Bank / LP"
};

export function OnboardForm({ disabled, onSubmit }: Props) {
  const [target, setTarget] = useState("");
  const [type, setType] = useState<ActorType>("livestock");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !target) return;
    setPending(true);
    try {
      await onSubmit({ target, type });
      setTarget("");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="onboard-address">Wallet address</label>
      <input
        id="onboard-address"
        placeholder="0x..."
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />

      <label htmlFor="onboard-type">Actor category</label>
      <select
        id="onboard-type"
        value={type}
        onChange={(e) => setType(e.target.value as ActorType)}
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <button type="submit" disabled={pending || disabled || !target}>
        {pending ? "Onboarding…" : `Approve ${labels[type]}`}
      </button>
    </form>
  );
}
