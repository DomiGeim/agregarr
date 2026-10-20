const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sharp = require('sharp');

// Exercise the actual renderer method without loading database-backed services.
const filename = 'server/lib/overlays/OverlayTemplateRenderer.ts';
const source = ts.createSourceFile(
  filename,
  fs.readFileSync(filename, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
let method;
function visit(node) {
  if (
    ts.isMethodDeclaration(node) &&
    node.name.getText(source) === 'renderOverlayElements'
  ) {
    method = node.getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(method, 'Renderer method must exist');
const compiled = ts.transpileModule(
  'class Renderer { ' + method + ' }; return Renderer;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020 } }
).outputText;
const Renderer = new Function('sharp', 'logger', compiled)(sharp, {
  debug() {},
  error(message, details) {
    throw new Error(message + JSON.stringify(details));
  },
});

async function run() {
  const renderer = new Renderer();
  renderer.hasRequiredVariables = () => true;
  renderer.renderElement = async (element) =>
    sharp({
      create: {
        width: element.width,
        height: element.height,
        channels: 4,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();
  async function render(x, y, width, height) {
    return renderer.renderOverlayElements(
      1000,
      1500,
      {
        width: 1000,
        height: 1500,
        elements: [{ x, y, width, height, layerOrder: 0 }],
      },
      {}
    );
  }
  for (const [x, y, width, height, expected] of [
    [0, 200, 1400, 100, [0, 200, 1000, 100]],
    [-300, 200, 1400, 100, [0, 200, 1000, 100]],
    [950, 200, 100, 100, [950, 200, 50, 100]],
    [10, 20, 100, 100, [10, 20, 100, 100]],
  ]) {
    const overlays = await render(x, y, width, height);
    assert.equal(overlays.length, 1);
    const meta = await sharp(overlays[0].input).metadata();
    assert.deepEqual(
      [overlays[0].left, overlays[0].top, meta.width, meta.height],
      expected
    );
    await sharp({
      create: { width: 1000, height: 1500, channels: 4, background: '#000000' },
    })
      .composite(overlays)
      .png()
      .toBuffer();
  }
  assert.deepEqual(await render(0, 1600, 1400, 100), []);
  assert.deepEqual(await render(-200, 20, 100, 100), []);
  console.log('Passed 6 renderer crop and composite scenarios.');
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
