# TypeScript package template

A template for TypeScript packages.

Related repos:

- [ts-cli-template](https://github.com/seb-cr/ts-cli-template): starting point for a command-line app using [`commander`](https://github.com/tj/commander.js)

## Usage

Click the **Use this template** button, or copy the contents of this repo into your project as the initial commit.

Then install dependencies and run the setup script to configure the template for your project:

```sh
npm i
./scripts/setup.ts
```

## Development notes

### Linting

Check for consistent code style by running `npm run lint`.

Linting is done by [ESLint](https://eslint.org) using [`@comicrelief/eslint-config`](https://github.com/comicrelief/eslint-config).

### Testing

Run all tests using `npm test`, or `npm run coverage` to see test coverage.

Individual test specs can also be run using the `mocha` command: `npx mocha tests/example.spec.ts`.

Inside your tests, you can import `src/*` modules using the `#src/*` path map, which saves having to write `../../../../src` in deep test directories.

Tests are run using [`ts-node`](https://typestrong.org/ts-node/docs/) and [`mocha`](https://mochajs.org), and coverage is provided by [`nyc`](https://istanbul.js.org).

### tsconfig.json

There are three `tsconfig`s:

- `tsconfig-base.json` contains our desired compiler options
- `tsconfig-build.json` is used to build the package
- `tsconfig.json` is used for development (this is what `ts-node` and VS Code look at)

We need separate configs for building and development. VS Code needs the `tests` directory to be listed in `include` in order to resolve path-mapped imports. However, we don't want the tests bundled with the compiled package. The build also shouldn't use type libraries for dev dependencies, such as `@types/mocha`.

### Publish using Semantic Release

This template repo is not set up to publish. Follow the steps below to automate releases with [Semantic Release](https://semantic-release.gitbook.io).

1. In the setup script, say yes to `Set up Semantic Release?`

2. Configure your repo to use the Squash and Merge strategy.

   > The setup script will attempt to do this for you if your Git client is configured to use an auth token over HTTPS.

   On GitHub, go to your repo > **Settings** > **General** > **Pull Requests** and untick *Allow merge commits* and *Allow rebase merging*, so that only *Allow squash merging* is enabled. Also enable *Default to PR title for squash merge commits*.

3. If you haven't already done so, make sure you've also protected your main branch. Any commits pushed to this branch will now trigger a release.

4. Set up [trusted publishing](https://docs.npmjs.com/trusted-publishers) for your package.

   > [!IMPORTANT]
   > At the time of writing, npm requires the package to already exist before you can configure its trusted publisher. This is bizarre; in order to publish a new package, you must either initially configure your CI workflow to use an npm token, or perform the build and publish workflow locally. Hopefully they will address this soon.
   >
   > This template is set up for the first solution – making the first release using a token. If you'd prefer to publish your first release manually, skip ahead to steps 6-7, then come back to steps 4-5 after publishing.

   1. Generate an npm token with write access to all packages and 2FA bypassed.
   2. Save it in a GitHub Actions secret called `NPM_TOKEN`.
   3. When you’re ready, publish your first release by pushing or merging releasable commits into the `main` branch.
   4. Now revoke the npm token and remove the `NPM_TOKEN` secret.
   5. Set up the trusted publisher on npm.

      Go to your package > **Settings** > **Trusted Publisher**. Select **GitHub Actions** and enter your repo details as directed.

   6. In the release job, uncomment the `id-token` permission and remove the `NPM_TOKEN` environment variable from the final step.

      ```diff
      --- a/.github/workflows/main.yml
      +++ b/.github/workflows/main.yml
      @@ -68,6 +68,5 @@
           permissions:
             contents: write
             issues: write
             pull-requests: write
      -      # TODO: after your first release, uncomment the line below
      -      #id-token: write
      +      id-token: write
      @@ -99,7 +98,4 @@
             - name: Release
               run: npx semantic-release
               env:
                 GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      -          # TODO: after your first release, remove \`NPM_TOKEN\` and set up a
      -          # trusted publisher instead
      -          NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
      ```

   7. Commit and push. You can use the commit message below as a template.

      ```sh
      git add .github/workflows/main.yml
      git commit -m "ci: Publish releases using OIDC instead of npm token

      The first release had to be authorised using an npm token. GitHub Actions has
      now been set as the package's trusted publisher, allowing subsequent publishes
      to be authorised using OpenID Connect."
      git push
      ```
