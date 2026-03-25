import esbuild from 'esbuild';

const isProduction = process.env.NODE_ENV === 'production';

const sharedOptions = {
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  platform: 'browser',
  minify: true,
  treeShaking: true,
  external: ['html2canvas'],
  sourcemap: !isProduction,
};

async function build() {
  const entryPoints = [
    { in: 'Public/main.js', out: 'main.min' },
    { in: 'Public/viewer.js', out: 'viewer.min' },
  ];

  for (const entry of entryPoints) {
    await esbuild.build({
      ...sharedOptions,
      entryPoints: [entry.in],
      outfile: `Public/dist/${entry.out}.js`,
    });
    console.log(`Built ${entry.out}.js`);
  }

  console.log('Build complete');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
