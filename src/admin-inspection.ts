import type { EncodedNode, EncodedValue } from "@sprengmeister/graphvault/internal/core/types";

export function summarizeNode(node: EncodedNode): string {
  if (node.kind === "array" || node.kind === "set") {
    return `${node.kind}(${node.items.length}) ${node.items.slice(0, 3).map(summarizeValue).join(", ")}`;
  }
  if (node.kind === "map") {
    return `map(${node.entries.length}) ${node.entries
      .slice(0, 3)
      .map(([key, value]) => `${summarizeValue(key)} => ${summarizeValue(value)}`)
      .join(", ")}`;
  }
  if (node.kind === "lazy") {
    return `lazy ${node.key}`;
  }
  return Object.entries(node.props)
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${summarizeValue(value)}`)
    .join(", ");
}

export function referencedChildren(node: EncodedNode): Array<[string, string]> {
  const children: Array<[string, string]> = [];
  visitNode(node, (path, value) => {
    if (value && typeof value === "object" && "$ref" in value) {
      children.push([path, value.$ref]);
    }
  });
  return children;
}

export function visitNode(node: EncodedNode, visit: (path: string, value: EncodedValue) => void): void {
  if (node.kind === "array" || node.kind === "set") {
    node.items.forEach((value, index) => visit(`[${index}]`, value));
  } else if (node.kind === "map") {
    node.entries.forEach(([key, value], index) => {
      visit(`entries[${index}].key`, key);
      visit(`entries[${index}].value`, value);
    });
  } else if (node.kind === "object") {
    for (const [key, value] of Object.entries(node.props)) {
      visit(key, value);
    }
    node.symbolProps?.forEach(([key, value], index) => {
      visit(`symbolProps[${index}].key`, key);
      visit(`symbolProps[${index}].value`, value);
    });
  } else {
    visit("lazy.key", { $type: "undefined" });
  }
}

function summarizeValue(value: EncodedValue): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    return value.length > 42 ? `${value.slice(0, 39)}...` : value;
  }
  if ("$ref" in value) {
    return `#${value.$ref}`;
  }
  if ("$type" in value) {
    if (value.$type === "date" || value.$type === "bigint") return value.value;
    if (value.$type === "undefined") return "undefined";
    return value.$type;
  }
  return JSON.stringify(value).slice(0, 80);
}
