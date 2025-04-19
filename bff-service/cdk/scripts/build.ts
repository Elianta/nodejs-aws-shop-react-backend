import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist-cdk');
const layerSrcDir = path.join(rootDir, 'layers/nodejs');
const layerDistDir = path.join(distDir, 'layers/nodejs');
const swaggerUiSrcDir = path.join(rootDir, 'functions/swagger-ui');
const swaggerUiDistDir = path.join(distDir, 'functions/swagger-ui');
const docsDir = path.join(rootDir, 'docs');

// Create dist directories
[distDir, layerDistDir, swaggerUiDistDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy layer files
console.log('>> Copying layer files...');
['package.json', 'package-lock.json'].forEach((file) => {
  if (fs.existsSync(path.join(layerSrcDir, file))) {
    fs.copyFileSync(
      path.join(layerSrcDir, file),
      path.join(layerDistDir, file),
    );
  }
});

// Install layer dependencies
console.log('>> Installing layer dependencies...');
execSync('npm install --production', {
  cwd: layerDistDir,
  stdio: 'inherit',
});

// Copy Swagger files
console.log('>> Copying Swagger UI files...');
if (fs.existsSync(path.join(swaggerUiSrcDir, 'swagger-ui.html'))) {
  fs.copyFileSync(
    path.join(swaggerUiSrcDir, 'swagger-ui.html'),
    path.join(swaggerUiDistDir, 'swagger-ui.html'),
  );
}
if (fs.existsSync(path.join(docsDir, 'swagger.yaml'))) {
  fs.copyFileSync(
    path.join(docsDir, 'swagger.yaml'),
    path.join(swaggerUiDistDir, 'swagger.yaml'),
  );
}
console.log('>> \u{2705} Build completed successfully!');
