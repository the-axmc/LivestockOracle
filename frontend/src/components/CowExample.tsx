import { useMemo, useState } from "react";
import type { Address } from "viem";
import { truncateAddress } from "../utils/format";

type StepId = "species" | "passport" | "loan" | "score" | "fund";

interface Step {
  id: StepId;
  title: string;
  detail: string;
  action(): Promise<void>;
}

interface Props {
  disabled?: boolean;
  owner?: Address;
  scenario: {
    speciesId: number;
    speciesName: string;
    unitDecimals: number;
    metadataNote: string;
    metadataHash: string;
    loanAmount: string;
    price: string;
    score: number;
    grantAmount: string;
    grantRef: string;
    payoutDate: string;
  };
  actions: {
    createSpecies(): Promise<void>;
    mintPassport(): Promise<void>;
    requestLoan(): Promise<void>;
    postCreditScore(): Promise<void>;
    fundLoan(): Promise<void>;
  };
}

const initialStatus: Record<StepId, "idle" | "pending" | "done" | "error"> = {
  species: "idle",
  passport: "idle",
  loan: "idle",
  score: "idle",
  fund: "idle"
};

export function CowExample({ disabled, owner, scenario, actions }: Props) {
  const [status, setStatus] = useState(initialStatus);

  const steps = useMemo<Step[]>(
    () => [
      {
        id: "species",
        title: "Create species",
        detail: `ID ${scenario.speciesId} • ${scenario.speciesName}`,
        action: actions.createSpecies
      },
      {
        id: "passport",
        title: "Mint passport",
        detail: `Owner ${owner ? truncateAddress(owner) : "connect wallet"} • note ${scenario.metadataNote}`,
        action: actions.mintPassport
      },
      {
        id: "loan",
        title: "Request loan",
        detail: `Borrow ${scenario.loanAmount} units (6 decimals)`,
        action: actions.requestLoan
      },
      {
        id: "score",
        title: "Define credit score",
        detail: `Price ${scenario.price} • score ${scenario.score}`,
        action: actions.postCreditScore
      },
      {
        id: "fund",
        title: "Give the loan",
        detail: `Voucher ${scenario.grantRef} • ${scenario.grantAmount} due ${scenario.payoutDate}`,
        action: actions.fundLoan
      }
    ],
    [actions, owner, scenario]
  );

  const runStep = async (step: Step) => {
    setStatus((prev) => ({ ...prev, [step.id]: "pending" }));
    try {
      await step.action();
      setStatus((prev) => ({ ...prev, [step.id]: "done" }));
    } catch (err) {
      console.error(err);
      setStatus((prev) => ({ ...prev, [step.id]: "error" }));
    }
  };

  const chipColor = (value: "idle" | "pending" | "done" | "error") => {
    switch (value) {
      case "done":
        return "#16a34a";
      case "pending":
        return "#f59e0b";
      case "error":
        return "#dc2626";
      default:
        return "#475569";
    }
  };

  return (
    <div className="card">
      <div className="section-title">
        <h3>Cow example walkthrough</h3>
      </div>
      <small className="help">
        One-click flow that touches every contract: species setup, passport mint,
        loan request, credit score, and grant disbursement.
      </small>
      <div className="grid" style={{ marginTop: 16 }}>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: 16,
              background: "rgba(148, 163, 184, 0.08)"
            }}
          >
            <div className="section-title" style={{ marginBottom: 4 }}>
              <span
                className="badge"
                style={{ background: "transparent", color: chipColor(status[step.id]) }}
              >
                {status[step.id] === "done"
                  ? "Complete"
                  : status[step.id] === "pending"
                    ? "Pending"
                    : status[step.id] === "error"
                      ? "Error"
                      : "Ready"}
              </span>
              <h3 style={{ fontSize: "1rem" }}>{step.title}</h3>
            </div>
            <p style={{ marginTop: 0, color: "#475569" }}>{step.detail}</p>
            <button
              onClick={() => runStep(step)}
              disabled={disabled || status[step.id] === "pending"}
              style={{ width: "100%" }}
            >
              {status[step.id] === "pending" ? "Processing…" : "Run step"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
