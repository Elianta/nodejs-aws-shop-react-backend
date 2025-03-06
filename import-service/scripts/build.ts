import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const layerSrcDir = path.join(rootDir, "layers/nodejs");
const layerDistDir = path.join(distDir, "layers/nodejs");

// Create dist directories
[distDir, layerDistDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy layer files
console.log(">> Copying layer files...");
["package.json", "package-lock.json"].forEach((file) => {
  if (fs.existsSync(path.join(layerSrcDir, file))) {
    fs.copyFileSync(
      path.join(layerSrcDir, file),
      path.join(layerDistDir, file)
    );
  }
});

// Install layer dependencies
console.log(">> Installing layer dependencies...");
execSync("npm install --production", {
  cwd: layerDistDir,
  stdio: "inherit",
});

console.log(">> \u{2705} Build completed successfully!");
