import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.3, resizeOptions: { background: '#D9653B' } },
    apple: { ...preset.apple, padding: 0.3, resizeOptions: { background: '#D9653B' } },
  },
  images: ['public/logo.svg'],
});
