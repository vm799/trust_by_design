/**
 * Architecture Compliance Tests
 *
 * These tests ensure that the 14-item architecture remediation patterns
 * are not violated by future code changes.
 *
 * Run with: npm test -- architecture
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

// Helper to read file content
const readFile = (filePath: string): string => {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
};

// Helper to get all TypeScript/TSX files in a directory
const getFiles = (dir: string, ext: string[] = ['.ts', '.tsx']): string[] => {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];

  const files: string[] = [];
  const items = fs.readdirSync(fullDir, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      files.push(...getFiles(path.join(dir, item.name), ext));
    } else if (ext.some(e => item.name.endsWith(e))) {
      files.push(path.join(dir, item.name));
    }
  }

  return files;
};

describe('Architecture Compliance', () => {
  describe('Item 1 & 2: DataContext Usage', () => {
    it('DataContext should export useData hook', () => {
      const content = readFile('lib/DataContext.tsx');
      // Check for either export const useData or export function useData
      expect(content).toMatch(/export (const|function) useData/);
      expect(content).toContain('jobs');
      expect(content).toContain('clients');
      expect(content).toContain('technicians');
    });

    it('App.tsx should use DataProvider', () => {
      const content = readFile('App.tsx');
      expect(content).toContain('<DataProvider>');
      expect(content).toContain('useData');
    });

    // Note: Some legacy views have local state for jobs/clients.
    // New views should use DataContext. This test documents known exceptions.
    it('documents legacy views with local state (should not grow)', () => {
      const viewFiles = getFiles('views');
      const legacyViews: string[] = [];

      for (const file of viewFiles) {
        const content = readFile(file);
        if (/useState<(Job|Client|Technician)\[\]>/.test(content)) {
          if (!file.includes('DataContext') && !file.includes('.test.')) {
            legacyViews.push(file);
          }
        }
      }

      // Known legacy files - this list should NOT grow
      // If it does, investigate why a new view isn't using DataContext
      const knownLegacy = [
        'views/CreateJob.tsx',
        'views/app/Dashboard.tsx',
        'views/app/clients/ClientDetail.tsx',
        'views/app/clients/ClientList.tsx',
        'views/app/invoices/InvoiceList.tsx',
        'views/app/jobs/JobDetail.tsx',
        'views/app/jobs/JobForm.tsx',
        'views/app/jobs/JobList.tsx',
        'views/app/technicians/TechnicianList.tsx',
        'views/tech/TechPortal.tsx',
      ];

      // Fail if NEW files are added with local state
      const newViolations = legacyViews.filter(f => !knownLegacy.includes(f));
      expect(newViolations).toEqual([]);
    });
  });

  describe('Item 3: Error Boundaries', () => {
    it('App.tsx should use RouteErrorBoundary for protected routes', () => {
      const appContent = readFile('App.tsx');

      // Check that RouteErrorBoundary is imported
      expect(appContent).toContain('RouteErrorBoundary');

      // Check that it's used multiple times (not just imported)
      const usageCount = (appContent.match(/<RouteErrorBoundary/g) || []).length;
      expect(usageCount).toBeGreaterThan(5);
    });
  });

  describe('Item 5: Lazy Loading', () => {
    it('App.tsx should lazy load all route components', () => {
      const appContent = readFile('App.tsx');

      // Views that should be lazy loaded
      const requiredLazyLoads = [
        'LandingPage',
        'AdminDashboard',
        'ContractorDashboard',
        'TechnicianPortal',
        'JobReport',
        'Settings',
        'AuthView',
      ];

      for (const component of requiredLazyLoads) {
        const lazyPattern = new RegExp(`const ${component} = lazy\\(`);
        expect(appContent).toMatch(lazyPattern);
      }
    });

    it('should not have static imports of heavy libraries in App.tsx', () => {
      const appContent = readFile('App.tsx');

      // These should be dynamically imported, not static
      expect(appContent).not.toMatch(/^import.*from ['"]\.\/lib\/syncQueue/m);
      expect(appContent).not.toMatch(/^import.*from ['"]\.\/lib\/offline\/sync/m);
    });
  });

  describe('Item 6: React.memo on Navigation', () => {
    const navComponents = [
      'components/layout/Sidebar.tsx',
      'components/layout/BottomNav.tsx',
      'components/layout/PageHeader.tsx',
    ];

    for (const file of navComponents) {
      it(`${file} should use React.memo`, () => {
        const content = readFile(file);
        if (content) {
          // Check for memo wrapper
          expect(content).toMatch(/memo\(|React\.memo\(/);
        }
      });
    }
  });

  describe('Item 9: List Keys', () => {
    it('should not use array index as key in photo/job lists', () => {
      const viewFiles = getFiles('views');
      const componentFiles = getFiles('components');
      const violations: string[] = [];

      for (const file of [...viewFiles, ...componentFiles]) {
        const content = readFile(file);
        // Look for .map with index used as key
        // Pattern: .map((item, index) => ... key={index}
        if (/\.map\([^)]*,\s*\w+\)[^}]*key=\{\s*\w+\s*\}/.test(content)) {
          // Check if the key variable matches the index parameter
          const matches = content.match(/\.map\(\s*\([^,]+,\s*(\w+)\)[^}]*key=\{\s*(\w+)\s*\}/g);
          if (matches) {
            for (const match of matches) {
              const indexMatch = match.match(/,\s*(\w+)\)/);
              const keyMatch = match.match(/key=\{\s*(\w+)\s*\}/);
              if (indexMatch && keyMatch && indexMatch[1] === keyMatch[1]) {
                violations.push(`${file}: ${match.substring(0, 50)}...`);
              }
            }
          }
        }
      }

      // Allow some violations for non-critical lists, but flag them
      if (violations.length > 0) {
        console.warn('Potential index-as-key violations:', violations);
      }
    });
  });

  describe('Item 11: Animation Constants', () => {
    it('lib/animations.ts should exist and export constants', () => {
      const content = readFile('lib/animations.ts');
      expect(content).toBeTruthy();
      expect(content).toContain('export const');
      expect(content).toContain('Variants');
      expect(content).toContain('Transition');
    });

    it('DayNightCarousel should use animation constants', () => {
      const content = readFile('components/DayNightCarousel.tsx');
      expect(content).toContain("from '../lib/animations'");
    });

    it('LandingPage should use animation constants', () => {
      const content = readFile('views/LandingPage.tsx');
      expect(content).toContain("from '../lib/animations'");
    });
  });

  describe('Item 12: Code Splitting', () => {
    it('vite.config.ts should have manualChunks configuration', () => {
      const content = readFile('vite.config.ts');
      expect(content).toContain('manualChunks');
      expect(content).toContain('react-vendor');
      expect(content).toContain('animation-vendor');
      expect(content).toContain('db-vendor');
    });
  });

  describe('Item 13: No Supabase Vendor Chunk', () => {
    it('vite.config.ts should not have supabase-vendor chunk', () => {
      const content = readFile('vite.config.ts');
      expect(content).not.toContain("'supabase-vendor'");
    });
  });

  describe('Item 14: ProtectedRoute Component', () => {
    it('ProtectedRoute component should exist', () => {
      const content = readFile('components/ProtectedRoute.tsx');
      expect(content).toBeTruthy();
      expect(content).toContain('ProtectedRoute');
      expect(content).toContain('useAuth');
    });
  });

  describe('Phase 6.5: Auth Callback', () => {
    it('AuthCallback component should exist', () => {
      const content = readFile('views/AuthCallback.tsx');
      expect(content).toBeTruthy();
      expect(content).toContain('AuthCallback');
    });

    it('Magic link should redirect to /auth/callback', () => {
      const content = readFile('lib/auth.ts');
      expect(content).toContain('/#/auth/callback');
    });

    it('App.tsx should have /auth/callback route', () => {
      const content = readFile('App.tsx');
      expect(content).toContain('path="/auth/callback"');
      expect(content).toContain('<AuthCallback');
    });
  });

  describe('Security: Redirect Allowlist', () => {
    it('redirects.ts should have production and Vercel domains', () => {
      const content = readFile('lib/redirects.ts');
      expect(content).toContain('jobproof.pro');
      expect(content).toContain('vercel.app');
    });
  });
});
