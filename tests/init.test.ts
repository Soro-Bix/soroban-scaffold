import { init } from '../src/commands/init.js';

describe('init command', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log the project name', async () => {
    await init('my-project');
    expect(consoleLogSpy).toHaveBeenCalledWith('Initializing project: my-project');
  });
});
