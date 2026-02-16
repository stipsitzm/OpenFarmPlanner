import { describe, it, expect } from 'vitest';
import * as autosave from '../hooks/autosave';

describe('hooks/autosave barrel exports', () => {
  it('exports autosave hooks and validation helpers', () => {
    expect(autosave.useAutosaveDraft).toBeTypeOf('function');
    expect(autosave.useNavigationBlocker).toBeTypeOf('function');
    expect(autosave.required).toBeTypeOf('function');
    expect(autosave.min).toBeTypeOf('function');
    expect(autosave.max).toBeTypeOf('function');
    expect(autosave.hexColor).toBeTypeOf('function');
    expect(autosave.isoDate).toBeTypeOf('function');
    expect(autosave.email).toBeTypeOf('function');
    expect(autosave.positive).toBeTypeOf('function');
    expect(autosave.nonNegative).toBeTypeOf('function');
    expect(autosave.oneOf).toBeTypeOf('function');
    expect(autosave.maxLength).toBeTypeOf('function');
    expect(autosave.minLength).toBeTypeOf('function');
    expect(autosave.validateFields).toBeTypeOf('function');
    expect(autosave.getNestedValue).toBeTypeOf('function');
  });
});
