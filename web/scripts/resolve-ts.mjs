import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Lets `node --test` load the app's TypeScript modules with the same specifiers
 * the bundler understands: the `@/` alias from tsconfig, and extensionless
 * relative imports. Node's own type stripping does the compiling.
 */
const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  let target = specifier;

  if (target.startsWith("@/")) {
    target = pathToFileURL(path.join(projectRoot, "src", target.slice(2))).href;
  } else if (target.startsWith(".") && context.parentURL?.startsWith("file:")) {
    target = new URL(target, context.parentURL).href;
  }

  if (!target.startsWith("file:")) {
    return nextResolve(specifier, context);
  }

  const basePath = fileURLToPath(target);
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${basePath}${suffix}`;
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }

  return nextResolve(specifier, context);
}
