using UnityEditor;
using UnityEngine;

namespace DX.Unity.Editor
{
    internal sealed class DxUnityCommandCenterWindow : EditorWindow
    {
        private string selectedCommand = DxUnityCommandPlans.ShowStatus;

        internal static void Open()
        {
            var window = GetWindow<DxUnityCommandCenterWindow>("DX Command Center");
            window.minSize = new Vector2(360, 220);
            window.Show();
        }

        private void OnGUI()
        {
            EditorGUILayout.LabelField("DX Command Center", EditorStyles.boldLabel);
            selectedCommand = EditorGUILayout.Popup(
                "Command",
                selectedCommand switch
                {
                    DxUnityCommandPlans.SearchAssets => 1,
                    DxUnityCommandPlans.ShowReceipts => 2,
                    _ => 0
                },
                new[] { "Show Status", "Search Assets", "Show Receipts Path" }) switch
            {
                1 => DxUnityCommandPlans.SearchAssets,
                2 => DxUnityCommandPlans.ShowReceipts,
                _ => DxUnityCommandPlans.ShowStatus
            };

            var plan = DxUnityCommandPlans.ForCommand(selectedCommand);
            var proofGate = DxUnityLocalServiceBoundary.CreateProofGate(plan);
            var availabilityNotice = proofGate.RequiresRuntimeProof
                ? "DX service connection is not configured for this host."
                : "DX receipt path is available in this host.";

            EditorGUILayout.HelpBox(
                $"{plan.Operation}\n\n{availabilityNotice}",
                MessageType.Info);
        }
    }
}
