import { ParseResult } from '../parser';
import { renderClass } from './classRenderer';

const render = (parseResult: ParseResult): string => {
  const classes: string[] = [];
  parseResult.classes.forEach((klass) => classes.push(renderClass(klass, parseResult)));
  return classes.join('\n\n');
};

export default render;
