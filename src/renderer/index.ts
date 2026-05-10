import { buildSelectionCatalogue, TransformResult } from '../transformer';
import { renderClass } from './classRenderer';
import { renderFragment } from './fragmentRenderer';

const render = (transformResult: TransformResult): string => {
  const selectionCatalogue = buildSelectionCatalogue(transformResult);
  const importStatements = new Set<string>();
  const fragments: string[] = [];
  const classes: string[] = [];

  transformResult.fragments.forEach((fragment) => {
    fragments.push(renderFragment(fragment, transformResult, selectionCatalogue));
  });

  transformResult.classes.forEach((klass) => {
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

    classes.push(renderClass(klass, transformResult, selectionCatalogue));
  });

  const imports = Array.from(importStatements);
  const output: string[] = [];
  if (imports.length > 0) {
    output.push(imports.join('\n'));
  }
  if (fragments.length > 0) {
    output.push(fragments.join('\n\n'));
  }
  if (classes.length > 0) {
    output.push(classes.join('\n\n'));
  }

  return output.join('\n\n');
};

export default render;
