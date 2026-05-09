import { ClassObject, FieldValue } from '../parser';
import { SelectionCatalogue } from '../selection';

export const determineFieldsToRender = (
  klass: ClassObject,
  selectionCatalogue: SelectionCatalogue
): FieldValue[] => {
  return selectionCatalogue.getFieldsToRender(klass);
};
