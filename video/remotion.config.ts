// Remotion's settings for `npm run studio` and `npm run render`.
// https://www.remotion.dev/docs/config
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
