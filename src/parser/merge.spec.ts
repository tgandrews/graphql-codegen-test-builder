import { mergeClasses } from './merge';
import { ClassObject, FieldValue, GQLKind } from './types';

describe('mergeClasses', () => {
  const nameField: FieldValue = {
    name: 'name',
    type: { kind: GQLKind.String, nullable: false },
  };
  const emailField: FieldValue = {
    name: 'email',
    type: { kind: GQLKind.String, nullable: false },
  };
  const ageField: FieldValue = {
    name: 'age',
    type: { kind: GQLKind.Int, nullable: false },
  };
  const idField: FieldValue = {
    name: 'id',
    type: { kind: GQLKind.String, nullable: false },
  };
  const filterField: FieldValue = {
    name: 'filter',
    type: { kind: GQLKind.String, nullable: false },
  };

  describe('operation classes', () => {
    it('should merge inputs and outputs, keeping existing operation metadata', () => {
      const existing: ClassObject = {
        id: 'GetUser:output',
        name: 'GetUser',
        inputs: [idField],
        outputs: [nameField],
        isInput: true,
        operation: 'Query',
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'GetUser',
        inputs: [],
        outputs: [nameField, emailField],
        isInput: true,
        operation: 'Query',
      };

      const result = mergeClasses(existing, incoming);

      expect(result.inputs).toEqual([idField]);
      expect(result.outputs).toEqual([nameField, emailField]);
      expect(result.operation).toBe('Query');
    });

    it('should pick larger inputs array', () => {
      const existing: ClassObject = {
        id: 'GetUser:output',
        name: 'GetUser',
        inputs: [],
        outputs: [nameField],
        isInput: true,
        operation: 'Mutation',
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'GetUser',
        inputs: [idField, filterField],
        outputs: [nameField],
        isInput: true,
        operation: 'Mutation',
      };

      const result = mergeClasses(existing, incoming);

      expect(result.inputs).toEqual([idField, filterField]);
    });
  });

  describe('non-operation classes - query selection merging', () => {
    it('should merge two partial selections and union selected fields', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField],
        isInput: false,
        isCompleteSchema: false,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [],
        outputs: [emailField],
        isInput: false,
        isCompleteSchema: false,
      };

      const result = mergeClasses(existing, incoming);

      expect(result.isCompleteSchema).toBe(false);
      expect(result.hasMultipleQueries).toBe(true);
      expect(result.selectedOutputs?.map((f) => f.name)).toEqual(['name', 'email']);
    });

    it('should merge complete existing with partial incoming', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField, ageField],
        selectedOutputs: [nameField],
        isInput: false,
        isCompleteSchema: true,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [],
        outputs: [emailField],
        isInput: false,
        isCompleteSchema: false,
      };

      const result = mergeClasses(existing, incoming);

      expect(result.isCompleteSchema).toBe(true);
      expect(result.hasMultipleQueries).toBe(true);
      expect(result.selectedOutputs?.map((f) => f.name)).toEqual(['name', 'email']);
    });

    it('should merge partial existing with complete incoming', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField],
        isInput: false,
        isCompleteSchema: false,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField, ageField],
        isInput: false,
        isCompleteSchema: true,
      };

      const result = mergeClasses(existing, incoming);

      expect(result.isCompleteSchema).toBe(true);
      expect(result.hasMultipleQueries).toBe(false);
      expect(result.selectedOutputs).toEqual([nameField]);
      expect(result.outputs).toEqual([nameField, emailField, ageField]);
    });

    it('should merge two complete classes with different selectedOutputs', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField, ageField],
        selectedOutputs: [nameField],
        isInput: false,
        isCompleteSchema: true,
        hasMultipleQueries: true,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField, ageField],
        selectedOutputs: [emailField, ageField],
        isInput: false,
        isCompleteSchema: true,
      };

      const result = mergeClasses(existing, incoming);

      expect(result.isCompleteSchema).toBe(true);
      expect(result.hasMultipleQueries).toBe(true);
      expect(result.selectedOutputs?.map((f) => f.name)).toEqual(['name', 'email', 'age']);
    });

    it('should preserve existing when both complete without selectedOutputs', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField],
        isInput: false,
        isCompleteSchema: true,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField],
        isInput: false,
        isCompleteSchema: true,
      };

      const result = mergeClasses(existing, incoming);

      expect(result.isCompleteSchema).toBe(true);
      expect(result.hasMultipleQueries).toBe(false);
      expect(result.selectedOutputs).toBeUndefined();
    });

    it('should pick larger arrays for inputs and outputs', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField],
        isInput: false,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [idField],
        outputs: [nameField, emailField],
        isInput: false,
      };

      const result = mergeClasses(existing, incoming);

      expect(result.inputs).toEqual([idField]);
      expect(result.outputs).toEqual([nameField, emailField]);
    });

    it('should not duplicate fields when merging selected outputs', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField],
        selectedOutputs: [nameField, emailField],
        isInput: false,
        isCompleteSchema: true,
        hasMultipleQueries: true,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField],
        selectedOutputs: [emailField, nameField],
        isInput: false,
        isCompleteSchema: true,
      };

      const result = mergeClasses(existing, incoming);

      expect(result.selectedOutputs).toHaveLength(2);
      expect(result.selectedOutputs?.map((f) => f.name)).toEqual(['name', 'email']);
    });

    it('should union outputs when same length but different fields', () => {
      const existing: ClassObject = {
        id: 'User:output',
        name: 'User',
        inputs: [],
        outputs: [nameField, emailField],
        isInput: false,
        isCompleteSchema: true,
      };
      const incoming: Omit<ClassObject, 'id'> = {
        name: 'User',
        inputs: [],
        outputs: [emailField, ageField], // Same count but different fields (field2 overlaps)
        isInput: false,
        isCompleteSchema: true,
      };

      const result = mergeClasses(existing, incoming);

      // Should union the fields: field2, field3 from incoming, then field1 from existing
      // Order follows: incoming fields first, then any new fields from existing
      expect(result.outputs).toHaveLength(3);
      expect(result.outputs.map((f) => f.name)).toEqual(['email', 'age', 'name']);
    });
  });
});
