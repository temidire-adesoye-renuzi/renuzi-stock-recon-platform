export default {
  entryPoints: ['smoke.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  outfile: 'smoke.bundle.mjs',
  define: {
    'import.meta.env.VITE_API_MODE': '"mock"',
    'import.meta.env.VITE_API_BASE_URL': '"http://localhost:4000/api/v1"',
  },
  logLevel: 'error',
}
