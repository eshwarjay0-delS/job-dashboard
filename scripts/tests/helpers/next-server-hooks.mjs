// Scoped to tests: remap `next/server` to the local stub so route tests can
// run with `node --import ./scripts/tests/helpers/next-server-hooks.mjs`
// (or by importing this file first) without installing node_modules.
import { registerHooks } from "node:module";

const stub = new URL("./next-server-stub.cjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server" || specifier === "next/server.js") {
      return { url: stub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
