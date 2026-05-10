import { ParseResult } from '../parser';
import { buildRenderPlan, RenderPlan } from '../renderPlan';
import { buildSelectionCatalogue } from '../selection';
import { renderClass } from './classRenderer';
import { renderFragment } from './fragmentRenderer';

const render = (
  parseResult: ParseResult,
  renderPlan: RenderPlan = buildRenderPlan(parseResult)
): string => {
  const selectionCatalogue = buildSelectionCatalogue(parseResult, renderPlan);
  const importStatements = new Set<string>();
  const fragments: string[] = [];
  const classes: string[] = [];

  parseResult.fragments.forEach((fragment) => {
    fragments.push(renderFragment(fragment, parseResult, selectionCatalogue));
  });

  parseResult.classes.forEach((klass) => {
    const userDefinedClass = renderPlan.getUserDefinedClass(klass);
    // Generate import statements for user-defined classes
    if (userDefinedClass) {
      const exportName = userDefinedClass.exportName;
      if (exportName) {
        importStatements.add(`import { ${exportName} } from '${userDefinedClass.path}';`);
      } else {
        importStatements.add(`import ${klass.name} from '${userDefinedClass.path}';`);
      }
      // Don't render the class itself - we're importing it
      return;
    }

    classes.push(renderClass(klass, parseResult, selectionCatalogue, renderPlan));
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
