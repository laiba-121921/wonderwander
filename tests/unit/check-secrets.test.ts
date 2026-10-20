import { describe, expect, it } from 'vitest';
import { findSecrets } from '../../scripts/check-secrets';

describe('findSecrets', () => {
  it('flags key-shaped strings', () => {
    // built by concatenation so this file does not trip the check itself
    expect(findSecrets('key=sb_' + 'secret_abcdefghijklmnop')).toEqual(['Supabase secret key']);
    expect(findSecrets('eyJ' + 'hbGciOiJIUzI1NiJ9.eyJ' + 'yb2xlIjoic2VydmljZSJ9.abcdefghijklmnop')).toEqual(['JWT (anon or service role key)']);
    expect(findSecrets(`AIza${'a'.repeat(35)}`)).toEqual(['Google API key']);
  });

  it('passes ordinary code and the variable names', () => {
    expect(findSecrets('const url = import.meta.env.VITE_SUPABASE_URL;')).toEqual([]);
  });
});
