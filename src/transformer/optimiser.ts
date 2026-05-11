import { Config } from '../types';
import { ClassObject, TransformResult } from './types';

const DEFAULT_INLINE_FIELD_COUNT_THRESHOLD = 3;

const shouldInlineClass = (klass: ClassObject, threshold: number): boolean => {
  if (!klass.isInput) {
    return true;
  }

  return klass.inputs.length <= threshold;
};

export function optimiseTransformResult(
  transformResult: TransformResult,
  config: Config = {}
): TransformResult {
  const threshold = config.inlineFieldCountThreshold ?? DEFAULT_INLINE_FIELD_COUNT_THRESHOLD;

  return {
    ...transformResult,
    classes: transformResult.classes.map((klass) => {
      if (klass.operation || klass.isSelectionBuilder || klass.userDefined) {
        return klass;
      }

      if (!shouldInlineClass(klass, threshold)) {
        return klass;
      }

      return {
        ...klass,
        shouldInline: true,
      };
    }),
  };
}
