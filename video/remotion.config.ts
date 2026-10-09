// Remotion's settings for `npm run studio` and `npm run render`.
// https://www.remotion.dev/docs/config
import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setCrf(18);
// standard range 4:2:0 in BT.709, what Instagram, TikTok and phones expect
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
// Remotion downloads its own headless Chrome the first time it renders.
// To use a browser you already have instead, set REMOTION_BROWSER_EXECUTABLE.
if (process.env.REMOTION_BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);

// The ad imports the builder's own modules from ../src/shop (pricing,
// catalog, the engraving drawing). Their `react` import must be this
// project's React, not the site's, or the hooks would see two Reacts.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      react: path.resolve(process.cwd(), "node_modules/react"),
      "react-dom": path.resolve(process.cwd(), "node_modules/react-dom"),
    },
  },
}));
