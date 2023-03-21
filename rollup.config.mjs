import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";

export default [
  {
    input: "src/main.svelte",
    output: {
      file: "dist/mainSSR.js",
      format: "cjs"
    },
    external: ["svelte/internal"],
    plugins: [
      svelte({
        compilerOptions: {
          generate: "ssr",
        },
        include: 'src/**/*.svelte',
        emitCss: false
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
        emitCss: false,
        include: 'src/**/*.svelte',
        compilerOptions: {
          hydratable: "true",
        }
      }),
      resolve({ 
        browser: true,
        exportConditions: ['svelte'],
        extensions: ['.svelte'],
      }),
    ]
  }
];
