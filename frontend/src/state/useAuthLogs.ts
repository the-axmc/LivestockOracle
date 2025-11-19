import { useMemo, useState } from "react";
import type { ActorType, AuthLogEntry } from "../types";

interface AuthLogs {
  livestock: AuthLogEntry[];
  cooperative: AuthLogEntry[];
  bank: AuthLogEntry[];
}

const emptyLogs: AuthLogs = {
  livestock: [],
  cooperative: [],
  bank: []
};

export function useAuthLogs() {
  const [logs, setLogs] = useState<AuthLogs>(emptyLogs);

  const pushLog = (type: ActorType, entry: Omit<AuthLogEntry, "type">) => {
    setLogs((prev) => {
      const next = { ...prev };
      next[type] = [
        {
          ...entry,
          type,
          timestamp: entry.timestamp ?? Date.now()
        },
        ...next[type]
      ].slice(0, 25);
      return next;
    });
  };

  const stats = useMemo(
    () => ({
      total: logs.livestock.length + logs.cooperative.length + logs.bank.length,
      livestock: logs.livestock.length,
      cooperative: logs.cooperative.length,
      bank: logs.bank.length
    }),
    [logs]
  );

  return { logs, pushLog, stats };
}
