/*
  Custom ESM loader to get TypeScript `paths` config working with `ts-node`.

  Based on https://github.com/TypeStrong/ts-node/discussions/1450

  `ts-node` may support this natively if they eventually merge
  https://github.com/TypeStrong/ts-node/pull/1585
*/

import { pathToFileURL } from 'url';

import { resolve as resolveTs } from 'ts-node/esm';
import * as tsConfigPaths from 'tsconfig-paths';

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig();
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths);

export function resolve(specifier, ctx, defaultResolve) {
  // remove `.js` extension before matching and add back on afterwards
  const match = specifier.endsWith('.js')
    ? matchPath(specifier.slice(0, -3))?.concat('.js')
    : matchPath(specifier);

  return match
    ? resolveTs(pathToFileURL(`${match}`).href, ctx, defaultResolve)
    : resolveTs(specifier, ctx, defaultResolve);
}

export {
  load,
  transformSource,
} from 'ts-node/esm';
