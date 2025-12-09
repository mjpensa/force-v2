/**
 * JavaScript Build Script
 * Minifies Public/*.js files using esbuild
 *
 * Usage: npm run build:js
 */

import * as esbuild from 'esbuild';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'Public');
const DIST_DIR = path.join(PUBLIC_DIR, 'dist');

// Files to minify (entry points and standalone modules)
const JS_FILES = [
  'main.js',
  'viewer.js',
  'GanttChart.js',
  'GanttEditor.js',
  'GanttExporter.js',
  'DraggableGantt.js',
  'ResizableGantt.js',
  'InteractiveGanttHandler.js',
  'ContextMenu.js',
  'TaskAnalyzer.js',
  'Utils.js',
  'config.js'
];

async function build() {
  const startTime = Date.now();
  console.log('🔨 Building JavaScript files...\n');

  // Ensure dist directory exists
  await fs.mkdir(DIST_DIR, { recursive: true });

  let totalOriginalSize = 0;
  let totalMinifiedSize = 0;
  const results = [];

  for (const file of JS_FILES) {
    const inputPath = path.join(PUBLIC_DIR, file);
    const outputPath = path.join(DIST_DIR, file.replace('.js', '.min.js'));

    try {
      // Check if file exists
      await fs.access(inputPath);

      // Get original size
      const originalStats = await fs.stat(inputPath);
      const originalSize = originalStats.size;

      // Minify with esbuild
      await esbuild.build({
        entryPoints: [inputPath],
        outfile: outputPath,
        bundle: false, // Don't bundle, just minify
        minify: true,
        sourcemap: process.env.NODE_ENV !== 'production',
        target: ['es2020'],
        format: 'esm',
        platform: 'browser'
      });

      // Get minified size
      const minifiedStats = await fs.stat(outputPath);
      const minifiedSize = minifiedStats.size;

      totalOriginalSize += originalSize;
      totalMinifiedSize += minifiedSize;

      const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
      results.push({
        file,
        original: (originalSize / 1024).toFixed(1),
        minified: (minifiedSize / 1024).toFixed(1),
        reduction
      });

      console.log(`  ✓ ${file}: ${(originalSize / 1024).toFixed(1)}KB → ${(minifiedSize / 1024).toFixed(1)}KB (-${reduction}%)`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`  ⚠ ${file}: Not found, skipping`);
      } else {
        console.error(`  ✗ ${file}: Error - ${err.message}`);
      }
    }
  }

  const totalReduction = ((1 - totalMinifiedSize / totalOriginalSize) * 100).toFixed(1);
  const duration = Date.now() - startTime;

  console.log('\n📊 Summary:');
  console.log(`   Total: ${(totalOriginalSize / 1024).toFixed(1)}KB → ${(totalMinifiedSize / 1024).toFixed(1)}KB (-${totalReduction}%)`);
  console.log(`   Time: ${duration}ms`);
  console.log(`   Output: ${DIST_DIR}/\n`);

  // Write manifest for reference
  const manifest = {
    buildTime: new Date().toISOString(),
    files: results,
    totalOriginalKB: (totalOriginalSize / 1024).toFixed(1),
    totalMinifiedKB: (totalMinifiedSize / 1024).toFixed(1),
    reductionPercent: totalReduction
  };
  await fs.writeFile(
    path.join(DIST_DIR, 'build-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('✅ Build complete!\n');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
