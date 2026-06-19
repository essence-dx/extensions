export interface ReleaseBlockerEvidenceKindOptions {
  packageEvidenceKind?: "content_package" | "package_output";
}

export function releaseBlockerEvidenceKind(
  blocker: string,
  options: ReleaseBlockerEvidenceKindOptions = {}
): string | undefined {
  const normalized = blocker.trim().toLowerCase();
  const packageEvidenceKind = options.packageEvidenceKind ?? "package_output";

  if (normalized === "native-host release package proof") {
    return "native_host_package";
  }

  if (normalized === "ccx package proof") {
    return "ccx_package";
  }

  if (isPackageBlocker(normalized)) {
    return packageEvidenceKind;
  }

  if (normalized === "checksum receipt" || normalized === "release checksum receipt") {
    return "checksum";
  }

  if (normalized === "signing receipt" || normalized === "package signing receipt") {
    return "signing";
  }

  if (normalized.includes("local-service") || normalized === "live local-service proof") {
    return "local_service";
  }

  if (normalized.startsWith("sideloaded ") && normalized.endsWith(" receipt")) {
    return "host_execution";
  }

  if (
    (normalized.startsWith("loaded ") && normalized.endsWith(" receipt")) ||
    normalized === "development canva app receipt" ||
    normalized === "loaded affinity app smoke" ||
    normalized === "test workspace file receipt"
  ) {
    return "host_execution";
  }

  if (normalized === "generated plugin id proof" || normalized === "plugin id proof") {
    return "plugin_id";
  }

  if (normalized === "apps script deployment proof") {
    return "apps_script_deployment";
  }

  if (normalized === "oauth consent proof" || normalized === "oauth review proof") {
    return "oauth_review";
  }

  if (normalized === "cloud-service proof" || normalized === "cloud service proof") {
    return "cloud_service";
  }

  if (normalized === "community review proof" || normalized === "community plugin review proof") {
    return "community_review";
  }

  if (normalized === "canva review proof") {
    return "canva_review";
  }

  if (normalized === "appsource readiness proof" || normalized === "appsource review proof") {
    return "appsource_review";
  }

  if (
    normalized === "gallery review proof" ||
    normalized === "plugin directory review proof" ||
    normalized === "distribution review proof" ||
    normalized === "marketplace review proof" ||
    normalized === "marketplace or distribution proof" ||
    normalized === "store distribution proof" ||
    normalized === "affinity distribution proof" ||
    normalized === "creative cloud review proof" ||
    normalized === "fab or marketplace review proof"
  ) {
    return "distribution_review";
  }

  if (normalized === "notarization proof") {
    return "notarization";
  }

  if (normalized === "sketchtool run proof") {
    return "sketchtool_run";
  }

  if (normalized === "plugin verifier receipt") {
    return "plugin_verifier";
  }

  if (normalized === "project import proof") {
    return "project_import";
  }

  if (normalized === "workflow integration proof" || normalized === "read-only project metadata proof") {
    return "workflow_integration";
  }

  if (normalized === "developer documentation version capture") {
    return "developer_docs";
  }

  if (normalized === "native or hybrid plugin proof") {
    return "native_or_hybrid_plugin";
  }

  if (
    normalized === "photoshop-compatible filter plugin proof" ||
    normalized === "photoshop filter plugin proof"
  ) {
    return "photoshop_filter_plugin";
  }

  return undefined;
}

function isPackageBlocker(normalized: string): boolean {
  return (
    normalized === "package proof" ||
    normalized === "release package proof" ||
    normalized === "release asset proof" ||
    normalized === "real content package proof" ||
    normalized.endsWith(" package proof") ||
    normalized === "package tarball proof" ||
    normalized === "plugin package proof"
  );
}
