import { describe, expect, it } from 'vitest';
import config from '../playwright.config';

describe('Playwright GOV-01 scaffold config', () => {
  it('does not reuse an arbitrary server already listening on the e2e port', () => {
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    expect(server).toBeDefined();
    expect(server?.reuseExistingServer).toBe(false);
  });

  it('runs the GOV-01 web app on the same repo-owned port used by baseURL', () => {
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    expect(config.use?.baseURL).toBe('http://127.0.0.1:3107');
    expect(server?.url).toBe('http://127.0.0.1:3107');
    expect(server?.command).toContain('@eyther/web');
    expect(server?.command).toContain('--port 3107');
  });
});
