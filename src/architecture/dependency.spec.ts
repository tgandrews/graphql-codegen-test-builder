import fs from 'fs';
import path from 'path';

function listTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(fullPath);
    }
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

describe('architecture dependencies', () => {
  it('keeps renderer independent of parser, selection, and render-plan modules', () => {
    const rendererFiles = listTypeScriptFiles(path.join(__dirname, '..', 'renderer')).filter(
      (file) => !file.endsWith('.spec.ts')
    );

    for (const file of rendererFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/from ['"]\.\.\/parser/);
      expect(source).not.toMatch(/from ['"]\.\.\/selection/);
      expect(source).not.toMatch(/from ['"]\.\.\/renderPlan/);
    }
  });

  it('keeps parser independent of plugin config', () => {
    const parserFiles = listTypeScriptFiles(path.join(__dirname, '..', 'parser')).filter(
      (file) => !file.endsWith('.spec.ts')
    );

    for (const file of parserFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/from ['"]\.\.\/types/);
    }
  });
});
