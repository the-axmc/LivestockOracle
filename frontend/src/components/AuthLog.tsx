import { formatTimestamp, truncateAddress } from "../utils/format";
import type { ActorType, AuthLogEntry } from "../types";

interface Props {
  title: string;
  type: ActorType;
  entries: AuthLogEntry[];
  accent?: string;
}

const accentByType: Record<ActorType, string> = {
  livestock: "#0ea5e9",
  cooperative: "#f59e0b",
  bank: "#16a34a"
};

export function AuthLog({ title, type, entries }: Props) {
  return (
    <div className="card">
      <div className="section-title">
        <span className="badge" style={{ color: accentByType[type] }}>
          {title}
        </span>
        <h3>Auth Log</h3>
      </div>
      <small className="help">
        Latest on-chain interactions recorded from the dashboard.
      </small>
      <div className="auth-log-entries">
        {entries.length === 0 && (
          <p style={{ color: "#94a3b8" }}>No activity yet.</p>
        )}
        {entries.map((entry) => (
          <div key={`${entry.timestamp}-${entry.actor}-${entry.action}`} className="auth-entry">
            <div className="meta">
              {formatTimestamp(entry.timestamp)} – {truncateAddress(entry.actor)}
            </div>
            <strong>{entry.action}</strong>
            {entry.details && <div>{entry.details}</div>}
            {entry.txHash && (
              <small className="help">tx: {truncateAddress(entry.txHash)}</small>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
