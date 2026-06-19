using System;
using System.ComponentModel.Design;
using System.Threading.Tasks;
using Dx.VisualStudio.CommandCenter.CommandPlans;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace Dx.VisualStudio.CommandCenter.Commands;

internal static class RegisterDxCommands
{
    internal static async Task RegisterAsync(AsyncPackage package)
    {
        await package.JoinableTaskFactory.SwitchToMainThreadAsync();
        var commandService = await package.GetServiceAsync(typeof(IMenuCommandService)) as IMenuCommandService;
        if (commandService is null)
        {
            return;
        }

        Register(commandService, CommandIds.ShowStatus);
        Register(commandService, CommandIds.SearchAssets);
        Register(commandService, CommandIds.ShowReceipts);
    }

    private static void Register(IMenuCommandService commandService, int commandId)
    {
        var menuCommandId = new CommandID(CommandIds.CommandSet, commandId);
        commandService.AddCommand(new MenuCommand(_ => ShowProofGate(commandId), menuCommandId));
    }

    private static void ShowProofGate(int commandId)
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        var plan = DxCommandPlans.ForCommand(commandId);
        var availabilityNotice = plan.RequiresRuntimeProof
            ? "DX service connection is not configured for this host."
            : "DX receipt path is available in this host.";
        VsShellUtilities.ShowMessageBox(
            ServiceProvider.GlobalProvider,
            $"{plan.Operation}\n\n{availabilityNotice}",
            "DX Command Center",
            OLEMSGICON.OLEMSGICON_INFO,
            OLEMSGBUTTON.OLEMSGBUTTON_OK,
            OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
    }
}
