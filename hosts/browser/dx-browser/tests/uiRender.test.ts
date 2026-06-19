import assert from "node:assert/strict";

class FakeElement {
  attributes = new Map();
  children = [];
  className = "";
  dataset = {};
  textContent = "";

  constructor(tagName) {
    this.tagName = tagName;
  }

  set innerHTML(_value) {
    this.children = [];
    this.textContent = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
    this.textContent = children.map((child) => child.textContent ?? "").join("");
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  querySelector(selector) {
    const match = /^\[data-([a-z-]+)\]$/.exec(selector);
    if (!match) {
      return undefined;
    }

    return this.findByDataset(toDatasetKey(match[1]));
  }

  findByDataset(key) {
    if (Object.prototype.hasOwnProperty.call(this.dataset, key)) {
      return this;
    }

    for (const child of this.children) {
      const match = child.findByDataset?.(key);
      if (match) {
        return match;
      }
    }

    return undefined;
  }
}

function toDatasetKey(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

globalThis.document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
};

const { renderCommandCenter } = await import(
  "../dist/js/ui/renderCommandCenter.js"
);
const { renderCommandStatus } = await import(
  "../dist/js/ui/commandStatus.js"
);

const root = new FakeElement("main");
renderCommandCenter(root, "DX Browser");

const commandList = root.children.find((child) => child.className === "command-list");
assert.ok(commandList, "command center should render a command list");
assert.deepEqual(
  commandList.children.map((child) => ({
    command: child.dataset.command,
    label: child.textContent
  })),
  [
    { command: "status", label: "DX Status" },
    { command: "doctor", label: "DX Doctor" },
    { command: "forgePackages", label: "DX Forge Packages" },
    { command: "showBuildGraph", label: "DX Build Graph" },
    { command: "openReceipts", label: "Open Receipts" }
  ],
  "command center should render every approved browser command"
);

const statusRegion = root.findByDataset("commandStatus");
assert.ok(statusRegion, "command center should include a command status region");
assert.equal(statusRegion.getAttribute("role"), "status");
assert.equal(statusRegion.getAttribute("aria-live"), "polite");

renderCommandStatus(root, {
  tone: "success",
  message: "DX Status completed.",
  receiptPath:
    ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
});

assert.equal(
  statusRegion.textContent,
  "DX Status completed. Receipt: .dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json",
  "command status should render the receipt path when present"
);
assert.equal(
  statusRegion.dataset.statusTone,
  "success",
  "command status should expose its visual tone"
);

console.log("browser command center rendering verified");
