import {
  ParsedDocument,
  ParsedFieldSelection,
  ParsedFragment,
  ParsedSchemaType,
  ParsedSelection,
  ParsedSelectionSet,
  ParsedTypeRef,
  ParsedVariable,
} from '../parser';
import { Config } from '../types';
import { capitalise } from '../utils';
import { TransformAccumulator } from './TransformAccumulator';
import { mergeFieldValuesByName } from './merge';
import { optimiseTransformResult } from './optimiser';
import { FieldValue, GQLKind, GQLType, SimpleGQLType, TransformResult } from './types';

type SelectionTransformResult = {
  outputs: FieldValue[];
  accumulator: TransformAccumulator;
  fragmentSpreads: string[];
};

function toScalarType(type: ParsedTypeRef): SimpleGQLType {
  if (type.kind !== 'scalar') {
    throw new Error(`Expected scalar type, received object type: ${type.name}`);
  }

  switch (type.name) {
    case 'string':
      return { kind: GQLKind.String, nullable: type.nullable };
    case 'int':
      return { kind: GQLKind.Int, nullable: type.nullable };
    case 'boolean':
      return { kind: GQLKind.Boolean, nullable: type.nullable };
    case 'float':
      return { kind: GQLKind.Float, nullable: type.nullable };
  }
}

function toGQLType(type: ParsedTypeRef, isInput: boolean): GQLType {
  if (type.kind === 'scalar') {
    return toScalarType(type);
  }

  return {
    id: `${type.name}:${isInput ? 'input' : 'output'}`,
    name: type.name,
    kind: GQLKind.Object,
    nullable: type.nullable,
  };
}

function requireSchemaType(parsed: ParsedDocument, typeName: string): ParsedSchemaType {
  const schemaType = parsed.schemaTypes.get(typeName);
  if (!schemaType) {
    throw new Error(`Unable to find parsed schema type: ${typeName}`);
  }
  return schemaType;
}

function transformSchemaType(
  typeName: string,
  parsed: ParsedDocument,
  accumulator: TransformAccumulator,
  activeTypes: string[] = []
): void {
  if (accumulator.getClass(`${typeName}:output`)) {
    return;
  }
  if (activeTypes.includes(typeName)) {
    return;
  }

  const schemaType = requireSchemaType(parsed, typeName);
  if (schemaType.kind !== 'object') {
    return;
  }

  const outputs = schemaType.fields.map<FieldValue>((field) => {
    if (field.type.kind === 'object') {
      transformSchemaType(field.type.name, parsed, accumulator, [...activeTypes, typeName]);
    }

    return {
      name: field.name,
      type: toGQLType(field.type, false),
      isList: field.type.isList,
    };
  });

  accumulator.addClass({
    name: schemaType.name,
    inputs: [],
    outputs,
    isInput: false,
    isCompleteSchema: true,
  });
}

function transformSelectionSet(
  name: string,
  selections: ParsedSelectionSet,
  schemaTypeName: string,
  parsed: ParsedDocument,
  config: Config,
  activeFragmentPath: string[] = [],
  selectionOwnerName = name,
  addSelectionClass = true
): SelectionTransformResult {
  const parsedSelections = selections.reduce<SelectionTransformResult>(
    (current, selection) => {
      const transformed = transformSelection(
        selection,
        schemaTypeName,
        parsed,
        config,
        activeFragmentPath,
        selectionOwnerName
      );

      current.accumulator.merge(transformed.accumulator);
      return {
        outputs: [...current.outputs, ...transformed.outputs],
        accumulator: current.accumulator,
        fragmentSpreads: [...current.fragmentSpreads, ...transformed.fragmentSpreads],
      };
    },
    {
      outputs: [],
      accumulator: new TransformAccumulator(config),
      fragmentSpreads: [],
    }
  );

  const mergedOutputs = mergeFieldValuesByName(parsedSelections.outputs);
  const fragmentSpreads = Array.from(new Set(parsedSelections.fragmentSpreads));

  if (addSelectionClass) {
    transformSchemaType(schemaTypeName, parsed, parsedSelections.accumulator);
    parsedSelections.accumulator.addClass({
      name,
      inputs: [],
      outputs: mergedOutputs,
      isInput: false,
    });
  }

  return {
    outputs: mergedOutputs,
    accumulator: parsedSelections.accumulator,
    fragmentSpreads,
  };
}

function transformFieldSelection(
  selection: ParsedFieldSelection,
  parsed: ParsedDocument,
  config: Config,
  activeFragmentPath: string[],
  selectionOwnerName: string
): SelectionTransformResult {
  if (selection.selectionSet?.length) {
    if (selection.type.kind !== 'object') {
      throw new Error(`Found a selection set on a non-object type: ${selection.name}`);
    }

    const typeName = selection.type.name;
    const result = transformSelectionSet(
      typeName,
      selection.selectionSet,
      typeName,
      parsed,
      config,
      activeFragmentPath,
      `${selectionOwnerName}${capitalise(selection.name)}`
    );
    const hasDirectSelections = selection.selectionSet.some((child) => child.kind === 'field');
    const shouldComposeFragments =
      result.fragmentSpreads.length > 1 ||
      (result.fragmentSpreads.length > 0 && hasDirectSelections);
    const selectionClassName = shouldComposeFragments
      ? `${selectionOwnerName}${capitalise(selection.name)}Selection`
      : typeName;
    const klass = result.accumulator.getClass(`${typeName}:output`);

    if (shouldComposeFragments) {
      result.accumulator.addClass({
        name: selectionClassName,
        inputs: [],
        outputs: result.outputs,
        isInput: false,
        isSelectionBuilder: true,
      });
    }

    return {
      outputs: [
        {
          name: selection.name,
          type: {
            id: `${selectionClassName}:output`,
            name: selectionClassName,
            kind: GQLKind.Object,
            nullable: selection.type.nullable,
          },
          isList: selection.type.isList,
          schemaTypeName: typeName,
          selectedFields:
            (klass?.selectedOutputs ?? klass?.outputs)?.map((field) => field.name) ?? [],
          fragmentSpreads:
            !shouldComposeFragments && result.fragmentSpreads.length > 0
              ? result.fragmentSpreads
              : undefined,
        },
      ],
      accumulator: result.accumulator,
      fragmentSpreads: [],
    };
  }

  return {
    outputs: [
      {
        name: selection.name,
        type: toGQLType(selection.type, false),
        isList: selection.type.isList,
      },
    ],
    accumulator: new TransformAccumulator(config),
    fragmentSpreads: [],
  };
}

function transformFragmentSpread(
  selection: ParsedSelection,
  parsed: ParsedDocument,
  config: Config,
  activeFragmentPath: string[]
): SelectionTransformResult {
  if (selection.kind !== 'fragment-spread') {
    throw new Error(`Unsupported fragment selection node type: ${selection.kind}`);
  }

  const fragment = parsed.fragments.find((candidate) => candidate.name === selection.name);
  if (!fragment) {
    throw new Error(`Unable to find fragment definition for: ${selection.name}`);
  }

  const accumulator = transformFragmentDefinition(fragment, parsed, config, activeFragmentPath);
  const transformedFragment = accumulator
    .toTransformResult(parsed)
    .fragments.find((candidate) => candidate.name === selection.name);
  if (!transformedFragment) {
    throw new Error(`Unable to parse fragment definition for: ${selection.name}`);
  }

  return {
    outputs: transformedFragment.outputs,
    accumulator,
    fragmentSpreads: [selection.name],
  };
}

function transformSelection(
  selection: ParsedSelection,
  schemaTypeName: string,
  parsed: ParsedDocument,
  config: Config,
  activeFragmentPath: string[] = [],
  selectionOwnerName = schemaTypeName
): SelectionTransformResult {
  switch (selection.kind) {
    case 'field':
      return transformFieldSelection(
        selection,
        parsed,
        config,
        activeFragmentPath,
        selectionOwnerName
      );
    case 'fragment-spread':
      return transformFragmentSpread(selection, parsed, config, activeFragmentPath);
  }
}

function transformVariable(
  variable: ParsedVariable,
  parsed: ParsedDocument,
  config: Config
): FieldValue {
  if (variable.type.kind !== 'object') {
    throw new Error(`GraphQL type ${variable.type.name} is not an input object type`);
  }

  const schemaType = requireSchemaType(parsed, variable.type.name);
  if (schemaType.kind !== 'input') {
    throw new Error(`GraphQL type ${variable.type.name} is not an input object type`);
  }

  const inputs = schemaType.fields.map<FieldValue>((field) => ({
    name: field.name,
    type: toGQLType(field.type, true),
    isList: field.type.isList,
  }));

  const accumulator = new TransformAccumulator(config);
  accumulator.addClass({
    name: schemaType.name,
    inputs,
    outputs: [],
    isInput: true,
  });

  return {
    name: variable.name,
    type: toGQLType(variable.type, true),
    isList: variable.type.isList,
  };
}

function transformOperation(
  operation: ParsedDocument['operations'][number],
  parsed: ParsedDocument,
  config: Config
): TransformAccumulator {
  const selectionResult = transformSelectionSet(
    operation.rootTypeName,
    operation.selectionSet,
    operation.rootTypeName,
    parsed,
    config,
    [],
    operation.name,
    false
  );

  const variableAccumulator = new TransformAccumulator(config);
  const inputs = operation.variables.map((variable) => {
    const input = transformVariable(variable, parsed, config);
    const schemaType = requireSchemaType(parsed, variable.type.name);
    variableAccumulator.addClass({
      name: schemaType.name,
      inputs: schemaType.fields.map<FieldValue>((field) => ({
        name: field.name,
        type: toGQLType(field.type, true),
        isList: field.type.isList,
      })),
      outputs: [],
      isInput: true,
    });
    return input;
  });

  selectionResult.accumulator.merge(variableAccumulator);
  selectionResult.accumulator.addClass({
    name: operation.name,
    inputs,
    outputs: mergeFieldValuesByName(selectionResult.outputs),
    isInput: true,
    operation: operation.operationType,
  });

  return selectionResult.accumulator;
}

function transformFragmentDefinition(
  fragment: ParsedFragment,
  parsed: ParsedDocument,
  config: Config,
  activeFragmentPath: string[] = []
): TransformAccumulator {
  const currentFragmentPath = [...activeFragmentPath, fragment.name];
  const selectionResult = transformSelectionSet(
    fragment.typeName,
    fragment.selectionSet,
    fragment.typeName,
    parsed,
    config,
    currentFragmentPath,
    fragment.name
  );
  const klass = selectionResult.accumulator.getClass(`${fragment.typeName}:output`);
  if (!klass) {
    throw new Error(`Unable to find parsed selection output for fragment: ${fragment.name}`);
  }

  selectionResult.accumulator.addFragment({
    name: fragment.name,
    typeName: fragment.typeName,
    outputs: klass.selectedOutputs ?? klass.outputs,
  });

  return selectionResult.accumulator;
}

function addDeclarations(result: TransformResult): TransformResult {
  return {
    ...result,
    imports: result.classes
      .filter((klass) => klass.userDefined)
      .map((klass) => ({
        path: klass.userDefined?.path ?? '',
        exportName: klass.userDefined?.exportName,
        localName: klass.userDefined?.exportName ?? klass.name,
      })),
    declarations: [
      ...result.fragments.map((fragment) => ({
        kind: 'builder' as const,
        name: `Mock${fragment.name}FragmentBuilder`,
        source: 'fragment' as const,
        inputFields: [],
        outputFields: fragment.outputs,
      })),
      ...result.classes
        .filter((klass) => !klass.userDefined)
        .map((klass) => ({
          kind: klass.shouldInline ? ('type-alias' as const) : ('builder' as const),
          name: klass.shouldInline
            ? `Mock${klass.name}Type`
            : `Mock${klass.name}${klass.operation ?? ''}Builder`,
          source: klass.operation
            ? ('operation' as const)
            : klass.isInput
            ? ('input' as const)
            : klass.isSelectionBuilder
            ? ('selection' as const)
            : ('object' as const),
          operationType: klass.operation,
          inputFields: klass.inputs,
          outputFields: klass.outputs,
          fields: klass.isInput ? klass.inputs : klass.selectedOutputs ?? klass.outputs,
        })),
    ],
  };
}

export function transform(parsed: ParsedDocument, config: Config = {}): TransformResult {
  const accumulator = new TransformAccumulator(config);

  for (const fragment of parsed.fragments) {
    accumulator.merge(transformFragmentDefinition(fragment, parsed, config));
  }

  for (const operation of parsed.operations) {
    accumulator.merge(transformOperation(operation, parsed, config));
  }

  const base = accumulator.toTransformResult(parsed);
  const optimised = config.enableOptimiser === false ? base : optimiseTransformResult(base, config);
  return addDeclarations(optimised);
}
