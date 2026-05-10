import { ClassObject, FieldValue } from '../transformer';
import { SelectionCatalogue } from '../transformer';

export const determineFieldsToRender = (
  klass: ClassObject,
  selectionCatalogue: SelectionCatalogue
): FieldValue[] => {
  return selectionCatalogue.getFieldsToRender(klass);
};
