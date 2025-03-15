import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const layerSrcDir = path.join(rootDir, "layers/nodejs");
const layerDistDir = path.join(distDir, "layers/nodejs");
const utilsSrcDir = path.join(layerSrcDir, "utils");
const utilsDistDir = path.join(layerDistDir, "utils");
const swaggerUiSrcDir = path.join(rootDir, "functions/swagger-ui");
const swaggerUiDistDir = path.join(distDir, "functions/swagger-ui");
const docsDir = path.join(rootDir, "docs");

// Function to copy directory recursively
function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      // Only copy .js files
      if (entry.name.endsWith(".js")) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Create dist directories
[distDir, layerDistDir, swaggerUiDistDir, utilsDistDir].forEach((dir) => {
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

// Copy Swagger files
console.log(">> Copying Swagger UI files...");
if (fs.existsSync(path.join(swaggerUiSrcDir, "swagger-ui.html"))) {
  fs.copyFileSync(
    path.join(swaggerUiSrcDir, "swagger-ui.html"),
    path.join(swaggerUiDistDir, "swagger-ui.html")
  );
}
if (fs.existsSync(path.join(docsDir, "swagger.yaml"))) {
  fs.copyFileSync(
    path.join(docsDir, "swagger.yaml"),
    path.join(swaggerUiDistDir, "swagger.yaml")
  );
}

// Copy utils directory
console.log(">> Copying utils files...");
copyDirRecursive(utilsSrcDir, utilsDistDir);

console.log(">> \u{2705} Build completed successfully!");
