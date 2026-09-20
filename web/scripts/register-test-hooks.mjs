import { register, registerHooks } from "node:module";
import { resolve } from "./resolve-ts.mjs";

/**
 * `registerHooks` is the current API and runs the hook in-thread;
 * `register` is the deprecated predecessor, kept as a fallback for Node
 * versions older than 22.15 that CI or a contributor might still be on.
 */
if (typeof registerHooks === "function") {
  registerHooks({ resolve });
} else {
  register("./resolve-ts.mjs", import.meta.url);
}
