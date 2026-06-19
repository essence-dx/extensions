package dev.dx.intellij.commands

data class DxCommandPlan(
    val actionId: String,
    val operation: String,
    val transport: String,
    val requiresRuntimeProof: Boolean,
    val mutatesProject: Boolean,
)

object DxCommandPlans {
    private val plans = listOf(
        DxCommandPlan(
            actionId = "dev.dx.intellij.showStatus",
            operation = "dx.status",
            transport = "local-service",
            requiresRuntimeProof = true,
            mutatesProject = false,
        ),
        DxCommandPlan(
            actionId = "dev.dx.intellij.searchAssets",
            operation = "dx.assets.search",
            transport = "local-service",
            requiresRuntimeProof = true,
            mutatesProject = false,
        ),
        DxCommandPlan(
            actionId = "dev.dx.intellij.showReceipts",
            operation = "receipt.showPath",
            transport = "host-ui",
            requiresRuntimeProof = false,
            mutatesProject = false,
        ),
    ).associateBy { it.actionId }

    fun forAction(actionId: String): DxCommandPlan? = plans[actionId]
}
