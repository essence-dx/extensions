package dev.dx.intellij.actions

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.Messages
import dev.dx.intellij.services.DxCommandPlanService

class DxCommandCenterAction : AnAction() {
    override fun actionPerformed(event: AnActionEvent) {
        val project = event.project
        val actionId = ActionManager.getInstance().getId(this) ?: return
        val plan = project?.service<DxCommandPlanService>()?.commandPlanFor(actionId) ?: return
        val availabilityNotice = if (plan.requiresRuntimeProof) {
            "DX service connection is not configured for this host."
        } else {
            "DX receipt path is available in this host."
        }
        val message = """
            ${plan.operation}

            $availabilityNotice
        """.trimIndent()

        Messages.showInfoMessage(project, message, "DX Command Center")
    }
}
