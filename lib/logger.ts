// Simple logger that is silent by default.
// Enable by setting NEXT_PUBLIC_DEBUG=true (client) or DEBUG=true (server).
const ENABLE = process.env.NEXT_PUBLIC_DEBUG === 'true' || process.env.DEBUG === 'true';

export const log = {
  debug: (...args: unknown[]) => {
    if (ENABLE) (console.debug as (...a: unknown[]) => void)(...args);
  },
  info: (...args: unknown[]) => {
    if (ENABLE) (console.info as (...a: unknown[]) => void)(...args);
  },
  warn: (...args: unknown[]) => {
    if (ENABLE) (console.warn as (...a: unknown[]) => void)(...args);
  },
  error: (...args: unknown[]) => {
    if (ENABLE) (console.error as (...a: unknown[]) => void)(...args);
  },
};

export default log;
