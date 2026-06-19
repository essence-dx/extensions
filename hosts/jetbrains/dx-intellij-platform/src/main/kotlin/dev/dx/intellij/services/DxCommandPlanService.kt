package dev.dx.intellij.services

import com.intellij.openapi.components.Service
import dev.dx.intellij.commands.DxCommandPlan
import dev.dx.intellij.commands.DxCommandPlans

@Service(Service.Level.PROJECT)
class DxCommandPlanService {
    fun commandPlanFor(actionId: String): DxCommandPlan? = DxCommandPlans.forAction(actionId)
}
