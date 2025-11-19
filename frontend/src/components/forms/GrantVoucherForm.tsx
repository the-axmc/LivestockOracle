import { useState } from "react";

interface Props {
  disabled?: boolean;
  onSubmit(payload: {
    beneficiary: string;
    amount: string;
    payoutDate: string;
    grantRef: string;
  }): Promise<void>;
}

export function GrantVoucherForm({ disabled, onSubmit }: Props) {
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("0");
  const [payoutDate, setPayoutDate] = useState("");
  const [grantRef, setGrantRef] = useState("grant-001");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiary || !payoutDate) return;
    setPending(true);
    try {
      await onSubmit({ beneficiary, amount, payoutDate, grantRef });
      setBeneficiary("");
      setAmount("0");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="voucher-beneficiary">Beneficiary</label>
      <input
        id="voucher-beneficiary"
        value={beneficiary}
        onChange={(e) => setBeneficiary(e.target.value)}
        placeholder="0x..."
      />

      <label htmlFor="voucher-amount">Amount (wei)</label>
      <input
        id="voucher-amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <label htmlFor="voucher-date">Expected payout date</label>
      <input
        type="date"
        id="voucher-date"
        value={payoutDate}
        onChange={(e) => setPayoutDate(e.target.value)}
      />

      <label htmlFor="voucher-ref">Grant reference</label>
      <input
        id="voucher-ref"
        value={grantRef}
        onChange={(e) => setGrantRef(e.target.value)}
      />

      <button
        type="submit"
        disabled={pending || disabled || !beneficiary || !payoutDate}
      >
        {pending ? "Minting…" : "Issue Voucher"}
      </button>
    </form>
  );
}
