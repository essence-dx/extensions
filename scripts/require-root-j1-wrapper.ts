const wrapperMarker = process.env.DX_EXTENSIONS_J1_WRAPPER;

if (wrapperMarker !== "1") {
  console.error("Use the root j1 wrapper for heavy workspace scripts.");
  process.exit(1);
}
