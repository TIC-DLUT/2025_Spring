import { defineConfig } from "vite";
import path from "path";
import vue from "@vitejs/plugin-vue";
//SVG插件
import { createSvgIconsPlugin } from "vite-plugin-svg-icons-ng";

export default defineConfig({
  plugins: [
    vue(),
    createSvgIconsPlugin({
      // 指定需要缓存的图标文件夹
      iconDirs: [path.resolve(process.cwd(), "src/assets/icons")],
      // 指定symbolId格式
      symbolId: "icon-[dir]-[name]",
      /**
      //    * custom insert position
      //    * @default: body-last
      //    */
      inject: "body-last",

      // /**
      //  * custom dom id
      //  * @default: __svg__icons__dom__
      //  */
      customDomId: "__svg__icons__dom__",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // SSE 流式响应需要禁用压缩和缓冲
            if (proxyRes.headers["content-type"] === "text/event-stream") {
              delete proxyRes.headers["content-encoding"];
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        //你的less文件 地址
        additionalData: `
          @import "@/styles/variables.less";
          @import "@/styles/scrollBar.less";
          `,
        // @import "@/assets/styles/mixins.less";
        javascriptEnabled: true,
      },
    },
  },
});
