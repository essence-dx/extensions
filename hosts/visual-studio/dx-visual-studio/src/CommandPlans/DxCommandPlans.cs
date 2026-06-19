using System.Collections.Generic;
using Dx.VisualStudio.CommandCenter.Commands;

namespace Dx.VisualStudio.CommandCenter.CommandPlans;

internal static class DxCommandPlans
{
    private static readonly IReadOnlyDictionary<int, DxCommandPlan> Plans =
        new Dictionary<int, DxCommandPlan>
        {
            [CommandIds.ShowStatus] = new(
                CommandIds.ShowStatus,
                Operation: "dx.status",
                Transport: "local-service",
                RequiresRuntimeProof: true,
                MutatesSolution: false),
            [CommandIds.SearchAssets] = new(
                CommandIds.SearchAssets,
                Operation: "dx.assets.search",
                Transport: "local-service",
                RequiresRuntimeProof: true,
                MutatesSolution: false),
            [CommandIds.ShowReceipts] = new(
                CommandIds.ShowReceipts,
                Operation: "receipt.showPath",
                Transport: "host-ui",
                RequiresRuntimeProof: false,
                MutatesSolution: false)
        };

    internal static DxCommandPlan ForCommand(int commandId) => Plans[commandId];
}
