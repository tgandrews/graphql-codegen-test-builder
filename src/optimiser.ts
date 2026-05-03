import { ClassObject, ParseResult } from './parser';

type OptimisingFn = (parseResult: ParseResult) => ParseResult;

const DEFAULT_INLINE_FIELD_COUNT_THRESHOLD = 3;

const shouldInlineClass = (klass: ClassObject, threshold: number): boolean => {
  if (!klass.isInput) {
    return true;
  }

  return klass.inputs.length <= threshold;
};

const inlineSmallClasses: OptimisingFn = (parseResult) => {
  const threshold =
    parseResult.getConfig().inlineFieldCountThreshold ?? DEFAULT_INLINE_FIELD_COUNT_THRESHOLD;

  parseResult.classes.forEach((klass) => {
    // If it's an operation don't touch it
    if (klass.operation) {
      return;
    }
    if (klass.isSelectionBuilder) {
      return;
    }
    // If it's a user-defined class, don't inline it (we'll import it instead)
    if (klass.userDefined) {
      return;
    }

    if (shouldInlineClass(klass, threshold)) {
      klass.shouldInline = true;
    }
  });
  return parseResult;
};

const rules: Array<OptimisingFn> = [inlineSmallClasses];

const optimiser = (parseResult: ParseResult): ParseResult => {
  if (parseResult.getConfig().enableOptimiser === false) {
    return parseResult;
  }

  return rules.reduce((result, fn) => fn(result), parseResult);
};

export default optimiser;
