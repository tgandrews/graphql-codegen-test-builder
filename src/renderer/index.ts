import { ParseResult } from '../parser';
import { renderClass } from './classRenderer';

const render = (parseResult: ParseResult): string => {
  const importStatements = new Set<string>();
  const classes: string[] = [];

  parseResult.classes.forEach((klass) => {
    // Generate import statements for user-defined classes
    if (klass.userDefined) {
      const exportName = klass.userDefined.exportName;
      if (exportName) {
        importStatements.add(`import { ${exportName} } from '${klass.userDefined.path}';`);
      } else {
        importStatements.add(`import ${klass.name} from '${klass.userDefined.path}';`);
      }
      // Don't render the class itself - we're importing it
      return;
    }

    classes.push(renderClass(klass, parseResult));
  });

  const imports = Array.from(importStatements);
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
