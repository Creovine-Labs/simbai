import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Lets `node --test` load the app's TypeScript modules with the same specifiers
 * the bundler understands: the `@/` alias from tsconfig, and extensionless
 * relative imports. Node's own type stripping does the compiling.
 *
 * This hook also sees CommonJS `require` calls from inside node_modules, so it
 * rewrites nothing outside `src/` and only ever resolves to a real file —
 * a bare directory would otherwise look like a match and break the CJS loader.
 */
const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const sourceRoot = path.join(projectRoot, "src");
const CANDIDATE_SUFFIXES = [".ts", ".tsx", "", "/index.ts", "/index.tsx"];

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function targetFor(specifier, parentURL) {
  if (specifier.startsWith("@/")) {
    return path.join(sourceRoot, specifier.slice(2));
  }

  if (specifier.startsWith(".") && parentURL?.startsWith("file:")) {
    const parent = fileURLToPath(parentURL);
    // Only rewrite imports made from our own source tree.
    if (parent.startsWith(sourceRoot + path.sep)) {
      return path.resolve(path.dirname(parent), specifier);
    }
  }

  return null;
}

export function resolve(specifier, context, nextResolve) {
  const target = targetFor(specifier, context.parentURL);

  if (target) {
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = `${target}${suffix}`;
      if (isFile(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
