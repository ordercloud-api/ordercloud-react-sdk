/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { name, version } from "./package.json";
import path from "path";
import dts from "vite-plugin-dts";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      fileName: "index",
      name: "@ordercloud/react-sdk",
    },
    rollupOptions: {
      // Externalize deps that shouldn't be bundled
      external: [
        "react",
        "react-dom",
        "axios",
        "ordercloud-javascript-sdk",
        "@tanstack/react-query",
        "@tanstack/react-table",
        "react-hook-form",
        "@hookform/resolvers",
        "@hookform/resolvers/yup",
      ],
      output: {
        // Global vars to use in UMD build for externalized deps
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          axios: "axios",
          "ordercloud-javascript-sdk": "ordercloud",
          "@tanstack/react-query": "ReactQuery",
          "@tanstack/react-table": "ReactTable",
          "react-hook-form": "ReactHookForm",
          "@hookform/resolvers": "HookFormResolvers",
          "@hookform/resolvers/yup": "HookFormResolversYup",
        },
      },
    },
  },
  define: {
    pkgJson: { name, version },
  },
  plugins: [
    react(),
    dts({ rollupTypes: true }),
    nodePolyfills({
      include: ["util", "querystring", "http", "https", "path"],
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
