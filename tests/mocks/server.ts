import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server for Node.js environment (Vitest tests)
export const server = setupServer(...handlers);

// Start server before all tests
export const startMockServer = () => {
  server.listen({ onUnhandledRequest: 'warn' });
};

// Reset handlers after each test
export const resetMockServer = () => {
  server.resetHandlers();
};

// Close server after all tests
export const closeMockServer = () => {
  server.close();
};
