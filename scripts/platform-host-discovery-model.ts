export interface PlatformHostDiscoveryTarget {
  adapterId: string;
  discoveryMode?: PlatformHostDiscoveryMode;
  host: string;
  readyReason?: string;
  unavailableReason: string;
  notes?: string[];
  tools: PlatformHostToolRequirement[];
}

export type PlatformHostDiscoveryMode = "local-tooling" | "manual-only" | "cloud-service";
export type PlatformHostDiscoveryStatus =
  | "candidate-found"
  | "missing"
  | "manual-only"
  | "cloud-service";

export interface PlatformHostToolRequirement {
  id: string;
  label: string;
  required: boolean;
  executableNames?: string[];
  candidatePaths?: string[];
}

export interface PlatformHostToolDiscovery {
  id: string;
  label: string;
  required: boolean;
  found: boolean;
  path: string | null;
  candidatesChecked: number;
}

export interface PlatformHostDiscoveryResult {
  written: PlatformHostDiscoveryPointer[];
}

export interface PlatformHostDiscoveryPointer {
  adapterId: string;
  path: string;
}
