#!/bin/bash
set -e

# default to releasing the `master` branch
BRANCH=${BRANCH:-master}

YELLOW=$"\x1b[33m"
RESET=$"\x1b[0m"

# 1. Install Semantic Release as a dev dependency

echo -e "$YELLOW- Installing Semantic Release$RESET"
npm i -D semantic-release

# 2. Configure the release branch if using something other than `master`

# `semantic-release` looks for the `master` branch by default
# https://github.com/semantic-release/semantic-release/blob/master/docs/usage/configuration.md#branches

if [ ! "$BRANCH" = master ]; then
  echo -e "$YELLOW- Configuring Semantic Release for branch '$BRANCH'$RESET"
  echo "branches:
  - '+([0-9])?(.{+([0-9]),x}).x'
  - $BRANCH
  - next
  - next-major
  - { name: 'beta', prerelease: true }
  - { name: 'alpha', prerelease: true }" > .releaserc.yml
fi

# 3. Add a release job to the GitHub Actions workflow

echo -e "$YELLOW- Adding release job to .github/workflows/main.yml$RESET"
if grep release: .github/workflows/main.yml >/dev/null; then
  echo -e "$YELLOW  ! Release job already exists; skipping this step$RESET"
else
  echo '
  release:
    name: Release
    if: github.ref == '"'refs/heads/$BRANCH'"'
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
          key: npm-cache-${{ hashFiles('"'"'package-lock.json'"'"') }}
          restore-keys: npm-cache-

      - name: Use npm@8
        run: npm i -g npm@8

      - name: Install dependencies
        run: npm ci

      - name: Release
        run: npx semantic-release
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}' >> .github/workflows/main.yml
fi

# 4. Enforce semantic PR titles

echo -e "$YELLOW- Adding PR check workflow to .github/workflows/pr.yml$RESET"
echo 'name: PR checks

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
' > .github/workflows/pr.yml

# Success!

echo
echo -e "${YELLOW}Semantic Release is now set up to release on push to $BRANCH.

Please follow the remaining steps to add your npm token and configure
your repo's pull requests. Make sure you've also protected your $BRANCH
branch if you haven't already done so.$RESET"
