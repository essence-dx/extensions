namespace Dx.VisualStudio.CommandCenter.CommandPlans;

internal sealed record DxCommandPlan(
    int CommandId,
    string Operation,
    string Transport,
    bool RequiresRuntimeProof,
    bool MutatesSolution);
