export type ActorType = "livestock" | "cooperative" | "bank";

export interface AuthLogEntry {
  actor: string;
  type: ActorType;
  action: string;
  details?: string;
  txHash?: string;
  timestamp: number;
}
