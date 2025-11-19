import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit(payload: { amount: string }): Promise<void>;
}

export function LoanRequestForm({ disabled, onSubmit }: Props) {
  const [amount, setAmount] = useState("100000000");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!amount) return;
    setPending(true);
    try {
      await onSubmit({ amount });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="loan-amount">Loan amount (6 decimals)</label>
      <input
        id="loan-amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <small className="help">
        Matches the stable token decimals (example: 100000000 = 100 units).
      </small>
      <button type="submit" disabled={pending || disabled || !amount}>
        {pending ? "Requesting…" : "Request Loan"}
      </button>
    </form>
  );
}
