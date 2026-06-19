export function readBrowserExtensionOrigin(extensionUrl?: string): string | undefined {
  if (!extensionUrl) {
    return undefined;
  }

  try {
    return parseBrowserExtensionOrigin(extensionUrl);
  } catch {
    return undefined;
  }
}

export function isTrustedBrowserMessageSender(
  sender: unknown,
  extensionOrigin?: string
): boolean {
  if (!extensionOrigin || !sender || typeof sender !== "object" || Array.isArray(sender)) {
    return false;
  }

  const senderUrl = (sender as { url?: unknown }).url;
  if (typeof senderUrl !== "string" || !senderUrl.trim()) {
    return false;
  }

  return readBrowserExtensionOrigin(senderUrl) === extensionOrigin;
}

function parseBrowserExtensionOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol === "chrome-extension:" || url.protocol === "moz-extension:") {
    return `${url.protocol}//${url.host}`;
  }

  return url.origin;
}
