/**
 * Build script: copies web assets to www/ folder for Capacitor
 * Since Degen Desk is a static site (no bundler), we just copy the files
 * and inject a small native bridge script for Capacitor plugins.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");

// Clean www folder
if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true });
}
fs.mkdirSync(WWW, { recursive: true });

// Files to copy to www
const filesToCopy = [
  "index.html",
  "pricing.html",
  "referrals.html",
  "privacy.html",
  "terms.html",
  "auth-callback.html",
  "token-analysis.html",
  "guides.html",
  "blog.html",
  "styles.css",
  "auth.js",
  "iap.js",
  "agent.js",
  "knowledge-base.js",
  "token-analysis.js",
  "sentry.js",
  "favicon.png",
  "og-image.png",
  "robots.txt",
  "sitemap.xml",
];

for (const file of filesToCopy) {
  const src = path.join(ROOT, file);
  const dest = path.join(WWW, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  Copied: ${file}`);
  } else {
    console.warn(`  Missing: ${file} (skipped)`);
  }
}

// Copy guides/logos/ directory recursively for the Setup Guides logos
function copyDir(src, dest, exts) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, exts);
    } else if (!exts || exts.some((e) => entry.name.endsWith(e))) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied: ${path.relative(ROOT, destPath)}`);
    }
  }
}
copyDir(path.join(ROOT, "guides", "logos"), path.join(WWW, "guides", "logos"), [".png", ".jpg", ".svg"]);

// Copy blog/ directory recursively (individual post pages)
copyDir(path.join(ROOT, "blog"), path.join(WWW, "blog"), [".html"]);

// Modify index.html for the native app
// - Add Capacitor bridge script
// - Add native-specific meta tags
const indexPath = path.join(WWW, "index.html");
let indexHtml = fs.readFileSync(indexPath, "utf-8");

// Add Capacitor native bridge and native init script before </body>
const nativeScripts = `
  <!-- Capacitor Native Bridge -->
  <script src="https://unpkg.com/@nicegoodthings/capacitor-core@latest/dist/capacitor.js" type="module"></script>
  <script type="module">
    // Native app initialization
    import { Capacitor } from '@capacitor/core';

    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add('native-app');

      // Import and configure status bar
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.setBackgroundColor({ color: '#06060b' });
      }).catch(() => {});

      // Import and configure keyboard
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        Keyboard.setAccessoryBarVisible({ isVisible: false });
      }).catch(() => {});

      // Import and hide splash screen after load
      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide();
      }).catch(() => {});

      // Handle external links — open in system browser
      import('@capacitor/browser').then(({ Browser }) => {
        document.addEventListener('click', (e) => {
          const link = e.target.closest('a[target="_blank"]');
          if (link) {
            e.preventDefault();
            Browser.open({ url: link.href });
          }
        });
      }).catch(() => {});
    }
  </script>
`;

indexHtml = indexHtml.replace("</body>", nativeScripts + "\n</body>");

// Add native CSS adjustments
const nativeCss = `
  <style>
    /* Native app adjustments */
    .native-app {
      /* Account for iOS safe areas (notch, home indicator) */
      --safe-top: env(safe-area-inset-top);
      --safe-bottom: env(safe-area-inset-bottom);
    }
    .native-app #chat-header {
      padding-top: calc(8px + var(--safe-top, 0px));
    }
    .native-app #sidebar {
      padding-top: var(--safe-top, 0px);
    }
    .native-app .input-area {
      padding-bottom: calc(8px + var(--safe-bottom, 0px));
    }
    .native-app #price-ticker {
      margin-bottom: var(--safe-bottom, 0px);
    }
    /* Disable text selection bounce on iOS */
    .native-app body {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: none;
    }
    /* Disable pull-to-refresh */
    .native-app {
      overscroll-behavior-y: contain;
    }
  </style>
`;

indexHtml = indexHtml.replace("</head>", nativeCss + "\n</head>");

fs.writeFileSync(indexPath, indexHtml);
console.log("  Patched: index.html (added native bridge + safe area styles)");

console.log("\n  Build complete! www/ folder ready for Capacitor.\n");
