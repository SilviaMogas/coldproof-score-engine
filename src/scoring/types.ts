export type ScoreStatus = "scored" | "insufficient_data";
export type Grade = "A+" | "A" | "B" | "C" | "D" | "Risk" | "N/A";

export interface CarrierMetrics {
  carrierId: string;
  ensName: string;
  totalShipments: number;
  completedShipments: number;
  compliantShipments: number;
  onTimeShipments: number;
  incidents: number;
  graphBlockNumber?: number;
  lastActivityTimestamp?: string;
}

export interface ScoreModel {
  scoreVersion: string;
  weights: { compliance: number; onTime: number; completion: number };
}

export interface ScoreResult {
  score: number;
  grade: Grade;
  status: ScoreStatus;
  complianceRate: number;
  onTimeRate: number;
  completionRate: number;
  scoreVersion: string;
  dataHash: string;
}
