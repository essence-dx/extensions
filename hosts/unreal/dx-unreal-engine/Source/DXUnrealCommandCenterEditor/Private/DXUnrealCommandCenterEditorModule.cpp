#include "DXUnrealCommandPlans.h"
#include "Framework/Notifications/NotificationManager.h"
#include "Modules/ModuleManager.h"
#include "ToolMenus.h"
#include "Widgets/Notifications/SNotificationList.h"

namespace
{
    const FString DxReceiptIndexPath =
        TEXT(".dx/receipts/extensions/dx.unreal-engine.command-center/host-action-index-latest.json");
}

class FDXUnrealCommandCenterEditorModule final : public IModuleInterface
{
public:
    void StartupModule() override
    {
        UToolMenus::RegisterStartupCallback(
            FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FDXUnrealCommandCenterEditorModule::RegisterMenus));
    }

    void ShutdownModule() override
    {
        UToolMenus::UnRegisterStartupCallback(this);
        UToolMenus::UnregisterOwner(this);
    }

private:
    void RegisterMenus()
    {
        UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
        FToolMenuSection& Section = Menu->AddSection("DXCommandCenter", FText::FromString("DX"));

        Section.AddMenuEntry(
            "DXShowStatus",
            FText::FromString("DX: Show Status"),
            FText::FromString("Show DX status metadata"),
            FSlateIcon(),
            FUIAction(FExecuteAction::CreateRaw(this, &FDXUnrealCommandCenterEditorModule::ShowProofGate, FName("dx.unreal-engine.show_status"))));

        Section.AddMenuEntry(
            "DXSearchAssets",
            FText::FromString("DX: Search Assets"),
            FText::FromString("Search DX assets through the future local-service bridge"),
            FSlateIcon(),
            FUIAction(FExecuteAction::CreateRaw(this, &FDXUnrealCommandCenterEditorModule::ShowProofGate, FName("dx.unreal-engine.search_assets"))));

        Section.AddMenuEntry(
            "DXShowReceipts",
            FText::FromString("DX: Show Receipts Path"),
            FText::FromString("Show DX receipt path metadata"),
            FSlateIcon(),
            FUIAction(FExecuteAction::CreateRaw(this, &FDXUnrealCommandCenterEditorModule::ShowProofGate, FName("dx.unreal-engine.show_receipts"))));
    }

    void ShowProofGate(FName CommandId)
    {
        const FDXUnrealCommandPlan* Plan = FDXUnrealCommandPlans::FindCommand(CommandId);
        if (Plan == nullptr)
        {
            ShowNotification(TEXT("DX command is not registered for this host."));
            return;
        }

        if (!Plan->bRequiresRuntimeProof && Plan->Transport == TEXT("host-ui"))
        {
            ShowNotification(
                Plan->Operation +
                TEXT("\n\n") +
                DxReceiptIndexPath);
            return;
        }

        ShowNotification(
            Plan->Operation +
            TEXT("\n\nDX service connection is not configured for this host."));
    }

    void ShowNotification(const FString& Message)
    {
        FNotificationInfo Info(FText::FromString(
            Message));
        Info.ExpireDuration = 8.0f;
        FSlateNotificationManager::Get().AddNotification(Info);
    }
};

IMPLEMENT_MODULE(FDXUnrealCommandCenterEditorModule, DXUnrealCommandCenterEditor)
