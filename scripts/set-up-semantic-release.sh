#!/bin/bash
set -e

npm i -D semantic-release

if [ ! "${BRANCH:-master}" = master ]; then
  # `semantic-release` looks for the `master` branch by default
  # https://github.com/semantic-release/semantic-release/blob/master/docs/usage/configuration.md#branches
  echo "branches:
  - '+([0-9])?(.{+([0-9]),x}).x'
  - $BRANCH
  - next
  - next-major
  - { name: 'beta', prerelease: true }
  - { name: 'alpha', prerelease: true }" > .releaserc.yml
fi

echo '
  release:
    name: Release
    if: github.ref == '"'refs/heads/${BRANCH:-master}'"'
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
