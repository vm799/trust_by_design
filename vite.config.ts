import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Security headers for production deployment
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for React
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://worldtimeapi.org",
    "frame-ancestors 'none'",
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
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
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
        // Aggressive code splitting
        rollupOptions: {
          output: {
            manualChunks: {
              // Vendor chunks
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'supabase-vendor': ['@supabase/supabase-js'],
              'db-vendor': ['dexie'],
              // Route chunks
              'auth-routes': [
                './views/AuthView.tsx',
                './views/EmailFirstAuth.tsx',
                './views/OAuthSetup.tsx',
                './views/SignupSuccess.tsx',
                './views/CompleteOnboarding.tsx'
              ],
              'admin-routes': [
                './views/AdminDashboard.tsx',
                './views/CreateJob.tsx',
                './views/ClientsView.tsx',
                './views/TechniciansView.tsx',
                './views/TemplatesView.tsx',
                './views/InvoicesView.tsx',
                './views/Settings.tsx',
                './views/ProfileView.tsx'
              ],
              'contractor-routes': [
                './views/ContractorDashboard.tsx',
                './views/TechnicianPortal.tsx'
              ],
              'client-routes': [
                './views/ClientDashboard.tsx',
                './views/JobReport.tsx'
              ],
              'public-routes': [
                './views/LandingPage.tsx',
                './views/PricingView.tsx',
                './views/RoadmapView.tsx',
                './views/HelpCenter.tsx',
                './views/LegalPage.tsx',
                './views/TrackLookup.tsx'
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
        exclude: []
      }
    };
});
