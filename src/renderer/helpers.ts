import { ClassObject, FieldValue } from '../parser';

export const determineFieldsToRender = (klass: ClassObject): FieldValue[] => {
  if (klass.isInput) {
    return klass.inputs;
  }
  if (klass.selectedOutputs) {
    return klass.selectedOutputs;
  }
  return klass.outputs;
};
