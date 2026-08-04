import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { init } from '../src/commands/init.js';

describe('init command', () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log the project name', async () => {
    await init('my-project');
    expect(consoleLogSpy).toHaveBeenCalledWith('Initializing project: my-project');
  });
});
