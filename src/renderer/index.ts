import { ParseResult } from '../parser';
import { renderClass } from './classRenderer';

const render = (parseResult: ParseResult): string => {
  const imports: string[] = [];
  const classes: string[] = [];

  parseResult.classes.forEach((klass) => {
    // Generate import statements for user-defined classes
    if (klass.userDefined) {
      const exportName = klass.userDefined.exportName;
      if (exportName) {
        imports.push(`import { ${exportName} } from '${klass.userDefined.path}';`);
      } else {
        imports.push(`import ${klass.name} from '${klass.userDefined.path}';`);
      }
      // Don't render the class itself - we're importing it
      return;
    }

    classes.push(renderClass(klass, parseResult));
  });

  const output: string[] = [];
  if (imports.length > 0) {
    output.push(imports.join('\n'));
  }
  if (classes.length > 0) {
    output.push(classes.join('\n\n'));
  }

  return output.join('\n\n');
};

export default render;
