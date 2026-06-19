using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;

namespace Dx.VisualStudio.CommandCenter;

[PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
[InstalledProductRegistration("DX Visual Studio Command Center", "DX host command center", "0.1.0")]
[ProvideMenuResource("Menus.ctmenu", 1)]
[Guid(PackageGuidString)]
public sealed class DxCommandCenterPackage : AsyncPackage
{
    public const string PackageGuidString = "7e318985-fc02-45de-b516-c8dca8b01f90";

    protected override async Task InitializeAsync(
        CancellationToken cancellationToken,
        IProgress<ServiceProgressData> progress)
    {
        await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
        await Commands.RegisterDxCommands.RegisterAsync(this);
    }
}
