export type LocalServiceTransport = "loopback-http" | "loopback-websocket";
export type LocalServiceHostState = "loaded" | "empty" | "unavailable";
export type LocalServiceResponseStatus = "ok" | "proof-blocked";

export interface LocalServiceProof {
  adapterId: string;
  host: string;
  receiptPath: string;
  loadedHostReceiptPath: string;
  proofFilePath: string;
  protocol: "dx.local-service";
  schemaVersion: 1;
  serviceEndpointHost: string;
  serviceEndpointPort: number;
  serviceTransport: LocalServiceTransport;
  localServiceConnected: boolean;
  requests: LocalServiceRequest[];
  responses: LocalServiceResponse[];
  hostState: LocalServiceHostState;
  storesHostPayloads: boolean;
  mutatesHostDocument: boolean;
}

export interface LocalServiceRequest {
  commandId: string;
  operation: string;
  metadataOnly: boolean;
  transport: "local-service";
  query?: string;
}

export interface LocalServiceResponse {
  commandId: string;
  status: LocalServiceResponseStatus;
  payloadKind: "metadata-only";
}

export interface LocalServiceReceiptOptions {
  generatedAt?: Date | string;
  verificationCommand?: string;
  proof: LocalServiceProof;
}

export interface LocalServiceReceipt {
  receipt: "dx.extension.local_service";
  adapterId: string;
  host: string;
  generatedAt: string;
  verificationCommand: string;
  receiptPath: string;
  loadedHost: {
    receiptPath: string;
    receiptSha256: string;
  };
  localService: {
    protocol: "dx.local-service";
    schemaVersion: 1;
    endpoint: {
      host: string;
      port: number;
      transport: LocalServiceTransport;
    };
    connected: true;
    hostState: LocalServiceHostState;
    requests: LocalServiceRequest[];
    responses: LocalServiceResponse[];
    storesHostPayloads: false;
    mutatesHostDocument: false;
  };
  manualProof: {
    proofFilePath: string;
    proofFileSha256: string;
  };
  releaseClaims: {
    loadedHostVerified: true;
    localServiceVerified: true;
    signingVerified: false;
    releaseChecksumVerified: false;
    distributionVerified: false;
  };
}

export interface LocalServiceValidationResult {
  proof: LocalServiceProof;
  loadedHostReceiptBytes: Buffer;
  proofFileBytes: Buffer;
}

export interface ReleaseGateEntry {
  id: string;
  evidence_receipt_requirements: string[];
}

export interface OfficialExtensionEntry {
  id: string;
  manifest: string;
}

export interface LocalServiceAction {
  id: string;
  operation: string;
}

export interface LoadedHostReceipt {
  adapterId?: unknown;
  host?: unknown;
  releaseClaims?: {
    loadedHostVerified?: unknown;
  };
}
