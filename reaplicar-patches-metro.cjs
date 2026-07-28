#!/usr/bin/env node
// reaplicar-patches-metro.cjs
//
// Depois de qualquer reinstalacao do zero (npm install / pnpm install que
// recria node_modules), os patches manuais aplicados no Metro e no
// react-native-css-interop se perdem - nao ha nenhum mecanismo automatico
// (postinstall, pnpm.patchedDependencies) que os reaplique sozinho.
//
// Esse script copia os arquivos ja corrigidos (salvos em patches/) de volta
// pros lugares certos dentro de node_modules.
//
// Rodar depois de TODA reinstalacao completa (ex: depois do "pnpm install"
// que fizemos pra sincronizar o pnpm-lock.yaml).

const fs = require('fs');
const path = require('path');

const COPIES = [
  {
    from: 'patches/css-interop-metro-index.js',
    to: 'node_modules/react-native-css-interop/dist/metro/index.js',
  },
  {
    from: 'patches/metro-bundler.js',
    to: 'node_modules/metro/src/Bundler.js',
  },
  {
    from: 'patches/metro-dependency-graph.js',
    to: 'node_modules/metro/src/node-haste/DependencyGraph.js',
  },
];

let ok = 0;
let problemas = 0;

for (const { from, to } of COPIES) {
  const fromPath = path.resolve(__dirname, from);
  const toPath = path.resolve(__dirname, to);

  if (!fs.existsSync(fromPath)) {
    console.error(`[ERRO] Patch nao encontrado: ${fromPath}`);
    problemas++;
    continue;
  }
  if (!fs.existsSync(path.dirname(toPath))) {
    console.error(`[ERRO] Pasta de destino nao existe (rodou npm/pnpm install?): ${path.dirname(toPath)}`);
    problemas++;
    continue;
  }

  fs.copyFileSync(fromPath, toPath);
  console.log(`[OK] ${from} -> ${to}`);
  ok++;
}

console.log('');
console.log(`Concluido: ${ok}/${COPIES.length} patches reaplicados${problemas > 0 ? `, ${problemas} problema(s)` : ''}.`);

if (problemas > 0) {
  process.exit(1);
}
