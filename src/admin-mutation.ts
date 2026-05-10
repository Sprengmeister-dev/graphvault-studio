import type { EncodedNode, EncodedValue } from "graphvault/internal/types";

export function getNodePath(node: EncodedNode, path: string): EncodedValue {
  return resolveNodePath(node, path).read();
}

export function setNodePath(node: EncodedNode, path: string, value: EncodedValue): void {
  resolveNodePath(node, path).write(value);
}

export function encodeAdminValue(value: unknown): EncodedValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "undefined") {
    return { $type: "undefined" };
  }
  if (typeof value === "bigint") {
    return { $type: "bigint", value: value.toString() };
  }
  throw new Error("Admin mutation values must be JSON primitives, undefined, or bigint.");
}

function resolveNodePath(node: EncodedNode, path: string): { read(): EncodedValue; write(value: EncodedValue): void } {
  const arrayIndex = /^\[(\d+)\]$/.exec(path);
  if ((node.kind === "array" || node.kind === "set") && arrayIndex?.[1]) {
    const index = Number(arrayIndex[1]);
    return {
      read: () => requireValue(node.items[index], path),
      write: (value) => {
        if (index < 0 || index >= node.items.length) {
          throw new Error(`Path ${path} is out of bounds.`);
        }
        node.items[index] = value;
      },
    };
  }

  const mapEntry = /^entries\[(\d+)\]\.(key|value)$/.exec(path);
  if (node.kind === "map" && mapEntry?.[1] && mapEntry[2]) {
    const index = Number(mapEntry[1]);
    const side = mapEntry[2] === "key" ? 0 : 1;
    return {
      read: () => requireValue(node.entries[index]?.[side], path),
      write: (value) => {
        const entry = node.entries[index];
        if (!entry) {
          throw new Error(`Path ${path} is out of bounds.`);
        }
        entry[side] = value;
      },
    };
  }

  if (node.kind === "object") {
    const symbolProp = /^symbolProps\[(\d+)\]\.(key|value)$/.exec(path);
    if (symbolProp?.[1] && symbolProp[2]) {
      const index = Number(symbolProp[1]);
      const side = symbolProp[2] === "key" ? 0 : 1;
      return {
        read: () => requireValue(node.symbolProps?.[index]?.[side], path),
        write: (value) => {
          const entry = node.symbolProps?.[index];
          if (!entry) {
            throw new Error(`Path ${path} is out of bounds.`);
          }
          entry[side] = value;
        },
      };
    }
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 1) {
      const key = parts[0] as string;
      return {
        read: () => requireValue(node.props[key], path),
        write: (value) => {
          node.props[key] = value;
        },
      };
    }
  }

  throw new Error(`Unsupported admin mutation path "${path}" for ${node.kind} node.`);
}

function requireValue(value: EncodedValue | undefined, path: string): EncodedValue {
  if (typeof value === "undefined") {
    throw new Error(`Path ${path} does not exist.`);
  }
  return value;
}
