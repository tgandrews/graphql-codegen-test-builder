import prettier from 'prettier';

export const prettify = (tsString: string) => {
  return prettier.format(tsString, { parser: 'typescript' });
};
