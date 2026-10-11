/* Test fixture: fresh context per test + console / page error capture (fails the test on errors). */
import { test as base, expect } from '@playwright/test';

export interface ConsoleLog { type: string; text: string }

export const test = base.extend<{ consoleLog: ConsoleLog[]; allowConsole: RegExp[] }>({
  allowConsole: [[], { option: true }],
  consoleLog: async ({ page, allowConsole }, provide, testInfo) => {
    const log: ConsoleLog[] = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', (e) => log.push({ type: 'pageerror', text: e.message }));
    await provide(log);
    if (log.length) await testInfo.attach('console.json', { body: JSON.stringify(log, null, 2), contentType: 'application/json' });
    const bad = log.filter((l) => (l.type !== 'warning' || /Warning:|React|act\(/.test(l.text)) && !allowConsole.some((r) => r.test(l.text)));
    expect(bad, `console errors / React warnings:\n${bad.map((b) => `${b.type}: ${b.text}`).join('\n')}`).toEqual([]);
  },
});

export { expect };
