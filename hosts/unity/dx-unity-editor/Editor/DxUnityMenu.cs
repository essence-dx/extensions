using UnityEditor;

namespace DX.Unity.Editor
{
    internal static class DxUnityMenu
    {
        [MenuItem("Window/DX/Command Center")]
        internal static void OpenCommandCenter()
        {
            DxUnityCommandCenterWindow.Open();
        }
    }
}
