import { App, ButtonComponent, Modal, Notice, Plugin } from "obsidian";

import {
  describeDxResult,
  DX_RECEIPTS_PATH,
  runApprovedDxCommand,
  type DxCommandId
} from "./dxCommandRunner";

export default class DxObsidianCommandCenter extends Plugin {
  async onload() {
    this.addRibbonIcon("terminal", "DX status", () => {
      void this.runDxCommand("status");
    });

    this.addCommand({
      id: "dx-show-status",
      name: "Show DX status",
      callback: () => {
        void this.runDxCommand("status");
      }
    });

    this.addCommand({
      id: "dx-run-doctor",
      name: "Run DX doctor",
      callback: () => {
        this.confirmDoctor();
      }
    });

    this.addCommand({
      id: "dx-copy-receipts-path",
      name: "Copy DX receipts path",
      callback: () => {
        void this.copyReceiptsPath();
      }
    });
  }

  private async runDxCommand(commandId: DxCommandId) {
    try {
      const result = await runApprovedDxCommand(commandId);
      new Notice(describeDxResult(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DX command error.";
      new Notice(`DX command failed: ${message}`);
    }
  }

  private confirmDoctor() {
    new DxConfirmationModal(
      this.app,
      "Run DX Doctor",
      "Run local DX diagnostics for this vault.",
      () => this.runDxCommand("doctor")
    ).open();
  }

  private async copyReceiptsPath() {
    try {
      await navigator.clipboard.writeText(DX_RECEIPTS_PATH);
      new Notice("DX receipts path copied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown clipboard error.";
      new Notice(`DX receipts path copy failed: ${message}`);
    }
  }
}

class DxConfirmationModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly onConfirm: () => Promise<void>
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    const controls = contentEl.createDiv({
      cls: "dx-command-center-confirmation-actions"
    });

    new ButtonComponent(controls)
      .setButtonText("Cancel")
      .onClick(() => {
        this.close();
      });

    new ButtonComponent(controls)
      .setButtonText("Run")
      .setCta()
      .onClick(() => {
        this.close();
        void this.onConfirm();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
