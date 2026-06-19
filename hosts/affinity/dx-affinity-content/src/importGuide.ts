export const AFFINITY_IMPORT_GUIDE = {
  assets: {
    extensions: [".afassets"],
    surface: "Assets panel",
    proof: "manual import proof remains deferred"
  },
  fonts: {
    extensions: [".affont", ".otf", ".ttf"],
    surface: "Fonts settings",
    proof: "manual import proof remains deferred"
  },
  swatches: {
    extensions: [".afpalette", ".ase"],
    surface: "Swatches panel",
    proof: "manual import proof remains deferred"
  },
  styles: {
    extensions: [".afstyles"],
    surface: "Styles panel",
    proof: "manual import proof remains deferred"
  },
  templates: {
    extensions: [".aftemplate"],
    surface: "New Document templates",
    proof: "manual import proof remains deferred"
  }
} as const;
