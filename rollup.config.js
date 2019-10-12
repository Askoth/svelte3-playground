import svelte from "rollup-plugin-svelte";
import node from "rollup-plugin-node-resolve";

export default [
  {
    input: "src/main.html",
    output: {
      file: "dist/mainSSR.js",
      format: "cjs"
    },
    external: ["svelte/internal"],
    plugins: [
      svelte({
        // By default, the client-side compiler is used. You
        // can also use the server-side rendering compiler
        generate: "ssr"
      })
    ]
  },
  {
    input: "src/index.js",
    output: {
      name: "main",
      file: "dist/main.js",
      format: "iife"
    },
    plugins: [
      svelte({
        // otherwise the constructor won't work
        // with "hydrate: true"
        hydratable: "true"
      }),

      // needed to add svelte/internal to the client code
      node()
    ]
  }
];
