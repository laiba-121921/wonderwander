import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
import { initContent } from '../src/content/load';

// Unit tests read content/ directly (CONTENT_SOURCE "local"); the domain list is filled before any test runs.
beforeAll(() => initContent());
afterEach(cleanup);
