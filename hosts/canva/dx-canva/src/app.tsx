import { DX_CANVA_COMMAND_PLANS, planForCanvaMessage } from "./commandPlans";
import { DX_CANVA_MESSAGES, isDxCanvaMessageType, type DxCanvaMessage } from "./messages";

const DX_RECEIPTS_PATH = ".dx/receipts";

function handleDxCanvaMessage(message: DxCanvaMessage): string {
  if (!isDxCanvaMessageType(message.type)) {
    return "DX command is not available.";
  }

  if (message.type === DX_CANVA_MESSAGES.copyReceiptsPath) {
    return DX_RECEIPTS_PATH;
  }

  const plan = planForCanvaMessage(message.type);
  if (!plan?.requiresRuntimeProof || plan.mutatesCanvaDesign) {
    return "DX command plan is unavailable.";
  }

  return "DX service connection is not configured for this host.";
}

function sendNotice(message: string): void {
  const output = document.querySelector<HTMLElement>("[data-dx-output]");
  if (output) {
    output.textContent = message;
  }
}

function createButton(label: string, command: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-command", command);
  button.textContent = label;
  return button;
}

function renderCommandCenter(root: HTMLElement): void {
  const query = document.createElement("input");
  query.type = "search";
  query.placeholder = "Search DX assets";

  const output = document.createElement("p");
  output.dataset.dxOutput = "true";

  root.append(
    createButton("Status", DX_CANVA_MESSAGES.showStatus),
    query,
    createButton("Assets", DX_CANVA_MESSAGES.searchAssets),
    createButton("Receipts", DX_CANVA_MESSAGES.copyReceiptsPath),
    output
  );

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const type = target.dataset.command;
    if (!type || !isDxCanvaMessageType(type)) {
      return;
    }

    sendNotice(
      handleDxCanvaMessage({
        type,
        query: query.value
      })
    );
  });
}

const root = document.querySelector<HTMLElement>("[data-dx-canva-root]");
if (root) {
  renderCommandCenter(root);
}

void DX_CANVA_COMMAND_PLANS;
