package dev.dx.intellij.toolwindow

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import javax.swing.BoxLayout

class DxToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = JBPanel<JBPanel<*>>()
        panel.layout = BoxLayout(panel, BoxLayout.Y_AXIS)
        panel.add(JBLabel("DX Command Center"))
        panel.add(JBLabel("DX service connection is not configured for this host."))
        panel.add(JBLabel("Receipt paths remain available from the host UI."))

        val content = toolWindow.contentManager.factory.createContent(panel, "Command Center", false)
        toolWindow.contentManager.addContent(content)
    }
}
