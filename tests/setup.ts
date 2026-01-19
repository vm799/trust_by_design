import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { startMockServer, resetMockServer, closeMockServer } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => {
  startMockServer();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  resetMockServer();
  localStorage.clear();
  sessionStorage.clear();
});

// Close MSW server after all tests
afterAll(() => {
  closeMockServer();
});

// Mock environment variables
beforeAll(() => {
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.VITE_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
});

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver (for lazy loading components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock Geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

// Mock IndexedDB
const indexedDBMock = {
  open: vi.fn(() => ({
    result: {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        })),
      })),
      createObjectStore: vi.fn(),
    },
    onsuccess: null,
    onerror: null,
  })),
  deleteDatabase: vi.fn(),
};
Object.defineProperty(window, 'indexedDB', {
  value: indexedDBMock,
  writable: true,
});

// Mock Canvas (for signature capture)
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillStyle: '',
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
})) as any;

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');

// Mock Crypto (for sealing operations)
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
    getRandomValues: (arr: any) => arr,
    subtle: {
      digest: vi.fn(async () => new ArrayBuffer(32)),
    },
  },
});

// Mock File API
global.File = class MockFile {
  constructor(
    public parts: any[],
    public name: string,
    public options?: any
  ) {}
} as any;

global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null;
  readAsDataURL = vi.fn(function (this: any, blob: Blob) {
    this.result = 'data:image/png;base64,mockbase64data';
    setTimeout(() => this.onload?.({ target: this }), 0);
  });
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
} as any;

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  },
});

// Mock window.alert, confirm, prompt
global.alert = vi.fn();
global.confirm = vi.fn(() => true);
global.prompt = vi.fn(() => 'mocked input');

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;
