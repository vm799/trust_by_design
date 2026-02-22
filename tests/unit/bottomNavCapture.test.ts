/**
 * BottomNav Capture Button
 *
 * PAUL: Unit test phase for Fix 29.
 *
 * BEFORE: BottomNav had 4 items: Dashboard, Jobs, Clients, Techs.
 * No quick access to photo capture from the main navigation.
 * Technicians had to navigate: Jobs → Job Detail → Capture.
 *
 * AFTER: BottomNav includes a Capture nav item with camera icon,
 * giving field workers one-tap access to evidence capture.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

const readFile = (filePath: string): string => {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
};

describe('BottomNav capture button', () => {
  const content = readFile('components/layout/BottomNav.tsx');

  it('should have a Capture nav item', () => {
    expect(content).toContain("label: 'Capture'");
  });

  it('should use photo_camera icon', () => {
    expect(content).toContain('photo_camera');
  });

  it('should link to tech portal for capture', () => {
    expect(content).toContain("to: '/tech'");
  });

  it('should maintain minimum 44px touch targets', () => {
    // All nav items must meet WCAG 44px minimum
    expect(content).toContain('min-h-[48px]');
  });

  it('should be wrapped in React.memo', () => {
    expect(content).toContain('memo(BottomNav)');
  });
});
