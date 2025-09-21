import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'offscreen.js',
  output: {
    file: 'offscreen.bundle.js',
    format: 'iife',
    name: 'OffscreenBundle',
    globals: {
      chrome: 'chrome'
    }
  },
  plugins: [
    resolve({
      browser: true,
      extensions: ['.js']
    }),
    commonjs()
  ],
  onwarn(warning, warn) {
    // Suppress eval warnings from chrome extension code
    if (warning.code === 'EVAL') return;
    warn(warning);
  }
};
