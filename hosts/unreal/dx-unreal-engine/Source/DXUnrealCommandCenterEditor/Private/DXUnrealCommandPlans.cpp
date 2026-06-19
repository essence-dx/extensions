#include "DXUnrealCommandPlans.h"

namespace
{
    const FDXUnrealCommandPlan ShowStatusPlan
    {
        TEXT("dx.unreal-engine.show_status"),
        TEXT("dx.status"),
        TEXT("local-service"),
        true,
        false
    };

    const FDXUnrealCommandPlan SearchAssetsPlan
    {
        TEXT("dx.unreal-engine.search_assets"),
        TEXT("dx.assets.search"),
        TEXT("local-service"),
        true,
        false
    };

    const FDXUnrealCommandPlan ShowReceiptsPlan
    {
        TEXT("dx.unreal-engine.show_receipts"),
        TEXT("receipt.showPath"),
        TEXT("host-ui"),
        false,
        false
    };
}

const FDXUnrealCommandPlan* FDXUnrealCommandPlans::FindCommand(FName CommandId)
{
    if (CommandId == ShowStatusPlan.CommandId)
    {
        return &ShowStatusPlan;
    }

    if (CommandId == SearchAssetsPlan.CommandId)
    {
        return &SearchAssetsPlan;
    }

    if (CommandId == ShowReceiptsPlan.CommandId)
    {
        return &ShowReceiptsPlan;
    }

    return nullptr;
}
