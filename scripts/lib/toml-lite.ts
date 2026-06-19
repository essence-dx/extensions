export function parseTomlDocument(source) {
  const document = {
    root: {},
    sections: {},
    arrays: {}
  };
  let currentTarget = document.root;

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const arraySection = /^\[\[([A-Za-z0-9_.-]+)\]\]$/.exec(trimmed);
    if (arraySection) {
      currentTarget = {};
      const collection = document.arrays[arraySection[1]] ?? [];
      collection.push(currentTarget);
      document.arrays[arraySection[1]] = collection;
      continue;
    }

    const tableSection = /^\[([A-Za-z0-9_.-]+)\]$/.exec(trimmed);
    if (tableSection) {
      currentTarget = document.sections[tableSection[1]] ?? {};
      document.sections[tableSection[1]] = currentTarget;
      continue;
    }

    const assignment = parseTomlAssignment(trimmed);
    if (assignment) {
      currentTarget[assignment.key] = assignment.value;
    }
  }

  return document;
}

function parseTomlAssignment(line) {
  const match = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
  if (!match) {
    return undefined;
  }

  return {
    key: match[1],
    value: parseTomlScalar(match[2])
  };
}

function parseTomlScalar(value) {
  const trimmed = value.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseTomlStringArray(trimmed);
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

function parseTomlStringArray(value) {
  const body = value.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  return body.split(",").map((item) => {
    const trimmed = item.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  });
}
