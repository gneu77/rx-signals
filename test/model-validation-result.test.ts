import {
  ModelValidationResult,
  isValidModelValidationResult,
  patchModelValidationResult,
} from '../src/type-utils';

type Model = {
  a: number;
  b: {
    c: {
      d: string;
    };
    e: boolean;
  };
  f: null | number;
};

describe('ModelValidationResult', () => {
  describe('patchModelValidationResult', () => {
    it('should update empty validation result', () => {
      const patch: ModelValidationResult<Model, string> = { b: { c: 'NoNoNo' } };
      const result = patchModelValidationResult<Model, string>(null, patch);
      expect(result).toBe(patch);

      const result2 = patchModelValidationResult<Model, string>({}, patch);
      expect(result2).not.toBe(patch);
      expect(result2).toEqual(patch);
    });

    it('should update existing validation result', () => {
      const patch: ModelValidationResult<Model, string> = { b: { c: 'NoNoNo' } };
      const result = patchModelValidationResult({ b: { c: { d: 'BÄM' } } }, patch);
      expect(result).toEqual(patch);

      const patch2: ModelValidationResult<Model, string> = { b: { c: { d: 'NoNoNo' } } };
      const result2 = patchModelValidationResult({ b: { c: { d: 'BÄM' } } }, patch2);
      expect(result2).toEqual(patch2);

      const result3 = patchModelValidationResult({ b: { c: { d: 'BÄM' }, e: 'Nope' } }, patch);
      expect(result3).toEqual({ b: { c: 'NoNoNo', e: 'Nope' } });
    });
  });

  describe('isValidModelValidationResult', () => {
    it('should return true for null', () => {
      expect(isValidModelValidationResult(null)).toBe(true);
    });

    it('should return true for only nested nulls', () => {
      expect(isValidModelValidationResult({ b: { c: { d: null }, e: null } })).toBe(true);
    });

    it('should return false for nested non-nulls', () => {
      expect(isValidModelValidationResult({ b: { c: { d: null }, e: 'BÄM' } })).toBe(false);
    });
  });
});
