import { readFile, readdir } from "node:fs/promises";

const assetsUrl = new URL("../dist/assets/", import.meta.url);
const assetNames = (await readdir(assetsUrl)).filter((name) => name.endsWith(".js"));
if (assetNames.length === 0) throw new Error("No built JavaScript assets found.");

const ajvCompilerMarker = "Error compiling schema, function code";
for (const assetName of assetNames) {
  const source = await readFile(new URL(assetName, assetsUrl), "utf8");
  if (source.includes(ajvCompilerMarker)) {
    throw new Error(`${assetName} contains Ajv's runtime compiler, which violates the production CSP.`);
  }
}

console.log(`Checked ${assetNames.length} JavaScript asset(s): no Ajv runtime compiler found.`);
