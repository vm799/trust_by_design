import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import type { Plugin } from 'vite';

// Get git commit hash for build fingerprint
function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

// Vite plugin: Inject app-version meta tag into HTML for Service Worker update detection
function injectAppVersionPlugin(): Plugin {
  const gitCommit = getGitCommit();
  const buildTime = new Date().toISOString();
  const appVersion = `${gitCommit}-${Date.now()}`;

  return {
    name: 'inject-app-version',
    transformIndexHtml(html: string) {
      // Inject app-version meta tag after theme-color meta tag
      const injected = html.replace(
        /(<meta name="theme-color"[^>]*>)/,
        `$1\n  <meta name="app-version" content="${appVersion}">\n  <meta name="build-time" content="${buildTime}">`
      );
      return injected;
    }
  };
}

// Security headers for production deployment
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live", // Required for React + Vercel
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://vercel.live",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://worldtimeapi.org https://fonts.googleapis.com https://fonts.gstatic.com https://vercel.live wss://vercel.live",
    "worker-src 'self' blob:",
    "frame-src 'self' https://vercel.live", // Allow Vercel toolbar iframes
    "frame-ancestors 'none'", // Prevent embedding by other sites (header only - ignored in meta tags)
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: mode === 'development' ? securityHeaders : undefined,
      },
      preview: {
        headers: securityHeaders,
      },
      plugins: [
        injectAppVersionPlugin(),
        react()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Build fingerprint variables for dev reset utility
        'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(getGitCommit()),
        'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify('1.0.0'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Optimize build output
        target: 'es2015',
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace']
          },
          mangle: true,
          format: {
            comments: false
          }
        },
        // REMEDIATION ITEM 12: Split large route chunks for better code splitting
        // Each chunk should be ~50-80KB for optimal loading
        rollupOptions: {
          output: {
            manualChunks: {
              // Vendor chunks
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'animation-vendor': ['framer-motion'],
              'db-vendor': ['dexie'],

              // Auth routes - split by flow
              'auth-routes': [
                './views/AuthView.tsx',
                './views/OAuthSetup.tsx',
                './views/SignupSuccess.tsx',
                './views/CompleteOnboarding.tsx'
              ],

              // Admin routes - split by function
              'admin-dashboard': [
                './views/AdminDashboard.tsx',
                './views/app/ManagerFocusDashboard.tsx',
                './views/ManagerIntentSelector.tsx'
              ],
              'admin-jobs': [
                './views/CreateJob.tsx',
                './views/JobCreationWizard.tsx',
                './views/app/jobs/JobsList.tsx',
                './views/ClientsView.tsx',
                './views/TechniciansView.tsx',
                './views/TemplatesView.tsx',
                './views/app/clients/ClientForm.tsx',
                './views/app/technicians/TechnicianForm.tsx'
              ],
              'admin-settings': [
                './views/Settings.tsx',
                './views/ProfileView.tsx',
                './views/HelpCenter.tsx'
              ],
              'admin-finance': [
                './views/InvoicesView.tsx'
              ],

              // Contractor routes - kept together (reasonable size)
              'contractor-routes': [
                './views/ContractorDashboard.tsx',
                './views/app/SoloContractorDashboard.tsx'
              ],

              // Technician portal - separate chunk (public access)
              'tech-portal': [
                './views/TechnicianPortal.tsx',
                './views/TrackLookup.tsx'
              ],

              // Client routes
              'client-routes': [
                './views/ClientDashboard.tsx',
                './views/JobReport.tsx'
              ],

              // Public routes - split landing from static pages
              'landing': [
                './views/LandingPage.tsx'
              ],
              'public-static': [
                './views/PricingView.tsx',
                './views/RoadmapView.tsx'
              ],

              // Onboarding - separate chunk
              'onboarding': [
                './views/ManagerOnboarding.tsx',
                './components/OnboardingTour.tsx'
              ],

              // Docs - separate chunk
              'docs': [
                './views/docs/AuditReport.tsx'
              ]
            },
            // Optimize chunk naming
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          }
        },
        // Increase chunk size warning limit (we're handling it with code splitting)
        chunkSizeWarningLimit: 600,
        // Enable source maps only for production debugging (optional)
        sourcemap: mode === 'development',
        // Optimize CSS
        cssCodeSplit: true,
        cssMinify: true,
        // Reduce asset inline limit to improve caching
        assetsInlineLimit: 4096
      },
      // Optimize dependencies
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js', 'dexie'],
        // Only scan the main entry point - exclude email templates and other non-app HTML
        entries: ['index.html'],
        exclude: []
      }
    };
});
