namespace DX.Unity.Editor
{
    internal sealed record DxUnityLocalServiceRequest(
        string Operation,
        string Transport,
        bool MetadataOnly,
        bool RequiresRuntimeProof);

    internal static class DxUnityLocalServiceBoundary
    {
        internal static DxUnityLocalServiceRequest CreateProofGate(DxUnityCommandPlan plan) =>
            new(
                Operation: plan.Operation,
                Transport: plan.Transport,
                MetadataOnly: true,
                RequiresRuntimeProof: plan.RequiresRuntimeProof);
    }
}
