import { listDxBrowserCommandPlans } from "../runtime/commandPlans.ts";
import { createCommandStatusRegion } from "./commandStatus.ts";

export function renderCommandCenter(root: HTMLElement, title: string): void {
  const commands = listDxBrowserCommandPlans();

  root.innerHTML = "";
  root.appendChild(createHeading(title));

  const list = document.createElement("div");
  list.className = "command-list";

  for (const command of commands) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-button";
    button.dataset.command = command.id;
    button.textContent = command.title;
    list.appendChild(button);
  }

  root.appendChild(list);
  root.appendChild(createCommandStatusRegion());
}

function createHeading(title: string): HTMLHeadingElement {
  const heading = document.createElement("h1");
  heading.textContent = title;
  return heading;
}
