import {
  buildSelectionCatalogue,
  ClassObject,
  FragmentObject,
  TransformBuilder,
  TransformDeclaration,
  TransformPickType,
  TransformResult,
} from '../transformer';
import { renderClass, renderTypeAlias } from './classRenderer';
import { renderFragment } from './fragmentRenderer';

function importStatement(importPlan: TransformResult['imports'][number]): string {
  if (importPlan.exportName) {
    if (importPlan.exportName === importPlan.localName) {
      return `import { ${importPlan.exportName} } from '${importPlan.path}';`;
    }
    return `import { ${importPlan.exportName} as ${importPlan.localName} } from '${importPlan.path}';`;
  }

  return `import ${importPlan.localName} from '${importPlan.path}';`;
}

function builderNameForClass(klass: ClassObject): string {
  return `Mock${klass.name}${klass.operation ?? ''}Builder`;
}

function findClassForBuilder(
  declaration: TransformBuilder,
  transformResult: TransformResult
): ClassObject {
  const klass = transformResult.classes.find(
    (candidate) =>
      !candidate.userDefined &&
      !candidate.shouldInline &&
      builderNameForClass(candidate) === declaration.name
  );

  if (!klass) {
    throw new Error(`Unable to find class for builder declaration: ${declaration.name}`);
  }

  return klass;
}

function findFragmentForBuilder(
  declaration: TransformBuilder,
  transformResult: TransformResult
): FragmentObject {
  const fragment = transformResult.fragments.find(
    (candidate) => `Mock${candidate.name}FragmentBuilder` === declaration.name
  );

  if (!fragment) {
    throw new Error(`Unable to find fragment for builder declaration: ${declaration.name}`);
  }

  return fragment;
}

function renderPickType(declaration: TransformPickType): string {
  const selectedFields = declaration.selectedFields
    .map((selectedField) => `"${selectedField}"`)
    .join(', ');
  return `type ${declaration.name} = Pick<${declaration.baseTypeName}, ${selectedFields}>;`;
}

function renderDeclaration(
  declaration: TransformDeclaration,
  transformResult: TransformResult,
  selectionCatalogue: ReturnType<typeof buildSelectionCatalogue>
): string {
  switch (declaration.kind) {
    case 'type-alias':
      return renderTypeAlias(declaration, transformResult, selectionCatalogue);
    case 'pick-type':
      return renderPickType(declaration);
    case 'builder':
      if (declaration.source === 'fragment') {
        return renderFragment(
          findFragmentForBuilder(declaration, transformResult),
          transformResult,
          selectionCatalogue
        );
      }
      return renderClass(
        findClassForBuilder(declaration, transformResult),
        transformResult,
        selectionCatalogue
      );
  }
}

const render = (transformResult: TransformResult): string => {
  const selectionCatalogue = buildSelectionCatalogue(transformResult);
  const imports = transformResult.imports.map(importStatement);
  const declarations = transformResult.declarations.map((declaration) =>
    renderDeclaration(declaration, transformResult, selectionCatalogue)
  );
  const output: string[] = [];
  if (imports.length > 0) {
    output.push(imports.join('\n'));
  }
  if (declarations.length > 0) {
    output.push(declarations.join('\n\n'));
  }

  return output.join('\n\n');
};

export default render;
