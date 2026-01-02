import { ParseResult } from './parser';

type OptimisingFn = (parseResult: ParseResult) => ParseResult;

const MIN_FIELD_COUNT = 3;
const inlineSmallClasses: OptimisingFn = (parseResult) => {
  parseResult.classes.forEach((klass) => {
    // If it's an operation don't touch it
    if (klass.operation) {
      return;
    }
    // If it's a user-defined class, don't inline it (we'll import it instead)
    if (klass.userDefined) {
      return;
    }
    if (klass.inputs.length < MIN_FIELD_COUNT) {
      klass.shouldInline = true;
    }
  });
  return parseResult;
};

const rules: Array<OptimisingFn> = [inlineSmallClasses];

const optimiser = (parseResult: ParseResult): ParseResult => {
  return rules.reduce((result, fn) => fn(result), parseResult);
};

export default optimiser;
