# TypeScript package template

A template for TypeScript packages.

## Usage

Copy the contents of this repo into your project, then follow this checklist.

- [ ] Update fields in `package.json`:
  - `name`
  - `description`
  - `author`
  - `repository`
- [ ] Add your code in `src`
- [ ] Add your tests in `tests`
- [ ] Optionally, [set up Semantic Release](#publish-using-semantic-release)
- [ ] Replace this readme with your own

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

### Publish using Semantic Release

This template repo is not set up to publish. Follow the steps below to automate releases with [Semantic Release](https://semantic-release.gitbook.io).

1. Install `semantic-release` as a dev dependency.

   ```sh
   npm i -D semantic-release
   ```

2. Add a `release` job to the GitHub Actions workflow.

   ```yaml
   # .github/workflows/main.yml

   jobs:
     # ...

     release:
       name: Release
       if: github.ref == 'refs/heads/master'
       needs:
         - test
         - lint
       runs-on: ubuntu-18.04
       steps:
         - uses: actions/checkout@v3
           with:
             fetch-depth: 0

         - uses: actions/setup-node@v3
           with:
             node-version: 14

         - name: Configure npm cache
           run: npm config set cache "$(pwd)/.npm-cache"

         - uses: actions/cache@v3
           with:
             path: .npm-cache
             key: npm-cache-${{ hashFiles('package-lock.json') }}
             restore-keys: npm-cache-

         - name: Install dependencies
           run: npm ci

         - name: Release
           run: npx semantic-release
           env:
             NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

3. Add your npm token in the `NPM_TOKEN` secret.

   Go to **Settings** > **Secrets** > **Actions** and click **New repository secret**.

Depending on your development workflow you may then want to ensure your main branch commits confirm to the Conventional Commit spec. To do this:

1. Configure your repo to use the Squash and Merge strategy.

   Go to **Settings** > **General** > **Pull Requests** and untick *Allow merge commits* and *Allow rebase merging*, so that only *Allow squash merging* is enabled. Also tick *Default to PR title for squash merge commits*.

2. Create a new GitHub Actions workflow to enforce semantic PR titles.

   ```yaml
   # .github/workflows/pr.yml
   name: PR checks

   on: pull_request

   jobs:
     # https://github.com/amannn/action-semantic-pull-request#example-config
     semantic-pr:
       name: Semantic pull request
       runs-on: ubuntu-latest
       steps:
         # Please look up the latest version from
         # https://github.com/amannn/action-semantic-pull-request/releases
         - uses: amannn/action-semantic-pull-request@v4
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```
