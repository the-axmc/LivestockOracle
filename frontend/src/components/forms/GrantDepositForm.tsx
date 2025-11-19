import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit(payload: { amount: string }): Promise<void>;
}

export function GrantDepositForm({ disabled, onSubmit }: Props) {
  const [amount, setAmount] = useState("0");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await onSubmit({ amount });
      setAmount("0");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="grant-amount">Grant amount (wei)</label>
      <input
        id="grant-amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button type="submit" disabled={pending || disabled}>
        {pending ? "Depositing…" : "Deposit"}
      </button>
    </form>
  );
}
