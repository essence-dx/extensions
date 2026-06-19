namespace DX.Unity.Editor
{
    internal sealed record DxUnityCommandPlan(
        string CommandId,
        string Operation,
        string Transport,
        bool RequiresRuntimeProof,
        bool MutatesProject);

    internal static class DxUnityCommandPlans
    {
        internal const string ShowStatus = "dx.unity-editor.show_status";
        internal const string SearchAssets = "dx.unity-editor.search_assets";
        internal const string ShowReceipts = "dx.unity-editor.show_receipts";

        internal static DxUnityCommandPlan ForCommand(string commandId) =>
            commandId switch
            {
                ShowStatus => new(
                    ShowStatus,
                    Operation: "dx.status",
                    Transport: "local-service",
                    RequiresRuntimeProof: true,
                    MutatesProject: false),
                SearchAssets => new(
                    SearchAssets,
                    Operation: "dx.assets.search",
                    Transport: "local-service",
                    RequiresRuntimeProof: true,
                    MutatesProject: false),
                ShowReceipts => new(
                    ShowReceipts,
                    Operation: "receipt.showPath",
                    Transport: "host-ui",
                    RequiresRuntimeProof: false,
                    MutatesProject: false),
                _ => throw new System.ArgumentOutOfRangeException(nameof(commandId), commandId, null)
            };
    }
}
