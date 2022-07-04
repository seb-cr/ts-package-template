# TypeScript package template

A template for TypeScript packages.

## Usage

Copy the contents of this repo into your project, then follow this checklist.

- [ ] Update fields in `package.json`:
  - `name`
  - `description`
  - `author`
  - `repository`
- [ ] Replace this readme with your own
- [ ] Add your code in `src`
- [ ] Add your tests in `tests`

## Development notes

### Linting

Check for consistent code style by running `npm run lint`.

Linting is done by [ESLint](https://eslint.org) using [`@comicrelief/eslint-config`](https://github.com/comicrelief/eslint-config).

### Testing

Run all tests using `npm test`, or `npm run coverage` to see test coverage.

Individual test specs can also be run using the `mocha` script: `npm run mocha -- tests/example.spec.ts`.

Inside your tests, you can import `src` modules using the `@/src` path map, which saves having to write `../../../../src` in deep test directories.

Tests are run using [`ts-node`](https://typestrong.org/ts-node/docs/) and [`mocha`](https://mochajs.org), and coverage is provided by [`nyc`](https://istanbul.js.org).

### tsconfig.json

There are three `tsconfig`s:

- `tsconfig-base.json` contains our desired compiler options
- `tsconfig-build.json` is used to build the package
- `tsconfig.json` is used for development (this is what `ts-node` and VS Code look at)

We need separate configs for building and development. VS Code needs the `tests` directory to be listed in `include` in order to resolve path-mapped imports. However, we don't want the tests bundled with the compiled package. The build also shouldn't use type libraries for dev dependencies, such as `@types/mocha`.
