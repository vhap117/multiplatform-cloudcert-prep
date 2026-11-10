import { describe, expect, it } from 'vitest';

import { SqlJsDriver } from './sqljs-driver';

let counter = 0;

function uniqueName(): string {
  counter += 1;
  return `sqljs-driver-${counter}`;
}

describe('SqlJsDriver', () => {
  it('returns rows keyed by column name, matching the Capacitor plugin', async () => {
    const driver = new SqlJsDriver(uniqueName());
    await driver.open();
    await driver.execute('CREATE TABLE sample (id TEXT, count INTEGER)');
    await driver.run('INSERT INTO sample (id, count) VALUES (?, ?)', ['a', 2]);

    const rows = await driver.query('SELECT * FROM sample');

    expect(rows).toEqual([{ id: 'a', count: 2 }]);
    await driver.close();
  });

  it('reads PRAGMA results by column name', async () => {
    const driver = new SqlJsDriver(uniqueName());
    await driver.open();
    await driver.execute('PRAGMA user_version = 3');

    const rows = await driver.query('PRAGMA user_version');

    expect(Number(rows[0]?.['user_version'])).toBe(3);
    await driver.close();
  });
});
