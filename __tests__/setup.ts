import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Extend matchers
expect.extend({});

// Cleanup after each test
afterEach(() => {
  cleanup();
}); 