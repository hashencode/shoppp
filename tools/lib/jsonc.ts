export function parseJsonc<T>(source: string): T {
  let output = "";
  let index = 0;
  let inString = false;
  let escaped = false;

  while (index < source.length) {
    const character = source[index]!;
    const next = source[index + 1];

    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      index += 1;
      continue;
    }

    if (character === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      continue;
    }

    output += character;
    index += 1;
  }

  return JSON.parse(output.replace(/,\s*([}\]])/g, "$1")) as T;
}
