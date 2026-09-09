import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LintOptions, LintResult } from '../types.js';

vi.mock('../runtime/node.js', () => ({
  createShellCheck: vi.fn(),
  resetCache: vi.fn(),
}));

vi.mock('../runtime/browser.js', () => ({
  createShellCheck: vi.fn(),
  resetCache: vi.fn(),
}));

describe('ShellCheck API Types', () => {
  it('should have correct LintOptions structure', () => {
    const options: LintOptions = {
      shell: 'bash',
      severity: 'warning',
      exclude: [2086],
      include: [2086, 2164],
      externalSources: true,
      sourcePaths: ['/path/to/scripts'],
      files: {
        'lib.sh': 'echo "library"',
      },
    };

    expect(options.shell).toBe('bash');
    expect(options.severity).toBe('warning');
    expect(options.exclude).toEqual([2086]);
    expect(options.include).toEqual([2086, 2164]);
    expect(options.externalSources).toBe(true);
    expect(options.sourcePaths).toEqual(['/path/to/scripts']);
    expect(options.files).toEqual({ 'lib.sh': 'echo "library"' });
  });

  it('should have correct LintResult structure', () => {
    const result: LintResult = {
      file: 'test.sh',
      line: 1,
      column: 6,
      endLine: 1,
      endColumn: 10,
      code: 2086,
      severity: 'warning',
      message: 'Double quote to prevent globbing and word splitting.',
      fix: {
        replacements: [
          {
            startLine: 1,
            startColumn: 6,
            endLine: 1,
            endColumn: 10,
            text: '"$VAR"',
          },
        ],
      },
    };

    expect(result.file).toBe('test.sh');
    expect(result.line).toBe(1);
    expect(result.code).toBe(2086);
    expect(result.severity).toBe('warning');
    expect(result.fix?.replacements).toHaveLength(1);
  });

  it('should allow optional fields in LintResult', () => {
    const minimalResult: LintResult = {
      file: 'test.sh',
      line: 5,
      column: 1,
      code: 2164,
      severity: 'error',
      message: 'Use cd ... || exit',
    };

    expect(minimalResult.endLine).toBeUndefined();
    expect(minimalResult.endColumn).toBeUndefined();
    expect(minimalResult.fix).toBeUndefined();
  });
});

describe('API response types', () => {
  it('should accept array of LintResult as success response', () => {
    const response: LintResult[] = [
      {
        file: 'test.sh',
        line: 1,
        column: 6,
        code: 2086,
        severity: 'warning',
        message: 'Double quote...',
      },
    ];

    expect(Array.isArray(response)).toBe(true);
  });

  it('should accept error object as error response', () => {
    const response = { error: 'WASM not initialized' };

    expect(response.error).toBe('WASM not initialized');
  });
});
