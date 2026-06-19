using System;

namespace Dx.VisualStudio.CommandCenter.Commands;

internal static class CommandIds
{
    internal static readonly Guid CommandSet = new("498c1497-9233-450a-922a-c32d8dc090ce");

    internal const int ShowStatus = 0x0100;
    internal const int SearchAssets = 0x0101;
    internal const int ShowReceipts = 0x0102;
}
