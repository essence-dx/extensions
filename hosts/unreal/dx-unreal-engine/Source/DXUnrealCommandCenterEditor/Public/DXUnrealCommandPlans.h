#pragma once

#include "CoreMinimal.h"

struct FDXUnrealCommandPlan
{
    FName CommandId;
    FString Operation;
    FString Transport;
    bool bRequiresRuntimeProof = true;
    bool bMutatesProject = false;
};

class FDXUnrealCommandPlans
{
public:
    static const FDXUnrealCommandPlan* FindCommand(FName CommandId);
};
