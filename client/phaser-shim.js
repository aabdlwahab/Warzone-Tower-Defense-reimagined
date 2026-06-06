// Shim used ONLY by the no-build play.html: Phaser is loaded as a UMD
// global (window.Phaser) via a <script> tag, and this re-exports it as
// the default so `import Phaser from 'phaser'` works without a bundler.
// The Vite build ignores this file and uses the real npm package.
export default window.Phaser;
