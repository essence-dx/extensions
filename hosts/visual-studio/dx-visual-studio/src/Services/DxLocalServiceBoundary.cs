namespace Dx.VisualStudio.CommandCenter.Services;

internal sealed record DxLocalServiceRequest(
    string Operation,
    string Transport,
    bool MetadataOnly,
    bool RequiresRuntimeProof);

internal static class DxLocalServiceBoundary
{
    internal static DxLocalServiceRequest CreateMetadataRequest(
        string operation,
        string transport,
        bool requiresRuntimeProof) =>
        new(
            Operation: operation,
            Transport: transport,
            MetadataOnly: true,
            RequiresRuntimeProof: requiresRuntimeProof);
}
