import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';
import chalk from 'chalk';
import inquirer, { Question } from 'inquirer';

import { Answers, setup, sh } from '../scripts/setup.js';

/*
  eslint-disable
  no-continue,
  @typescript-eslint/ban-ts-comment,
  @typescript-eslint/no-explicit-any,
*/

// @ts-ignore
inquirer.prompt = async (questions: Question[], answers: any) => {
  const result: Record<string, any> = {};
  for (const question of questions) {
    const { name, message } = question;
    const when = question.when as (answers: any) => boolean | undefined;
    if (name) {
      if (when && !when(result)) {
        continue;
      }
      let answer;
      if (name in answers) {
        answer = answers[name];
      } else if (question.default || question.type === 'input') {
        answer = question.default || '';
      } else {
        throw new Error(`No answer or default for question '${name}'`);
      }
      result[name] = answer;
      if (typeof answer === 'boolean') {
        answer = answer ? 'Yes' : 'No';
      }
      console.log(`? ${message} ${answer}`);
    }
  }
  return result;
};

let baseBranch: string;

function saveGitState() {
  before('save uncommitted changes', async () => {
    await sh('git commit --allow-empty -m "wip: staged changes"');
    await sh('git add .');
    await sh('git commit --allow-empty -m "wip: unstaged changes"');
  });

  before('save base branch name', async () => {
    baseBranch = await sh('git rev-parse --abbrev-ref HEAD');
    if (baseBranch === 'HEAD') {
      // detached HEAD state -- use commit hash instead
      baseBranch = await sh('git rev-parse HEAD');
    }
    // for debugging -- see README.md#known-issues
    console.log('git status:', await sh('git status'));
    console.log('git log:', await sh('git log'));
    console.log('baseBranch:', baseBranch);
  });

  after('restore uncommitted changes', async () => {
    const log = await sh('git log --oneline -2');
    const [firstCommit, secondCommit] = log.split('\n');

    // restore unstaged changes
    if (!firstCommit.includes('wip: unstaged changes')) {
      console.log(chalk.yellowBright('Unexpected commit when trying to restore unstaged changes!'));
      return;
    }
    await sh('git reset --soft HEAD~1');
    await sh('git reset HEAD');

    // restore staged changes
    if (!secondCommit.includes('wip: staged changes')) {
      console.log(chalk.yellowBright('Unexpected commit when trying to restore staged changes!'));
      return;
    }
    await sh('git reset --soft HEAD~1');
  });
}

function useTempGitAuthor(): string {
  const name = `Test user ${Math.floor(Math.random() * 1E6)}`;
  const email = 'test@example.com';
  let oldName: string;
  let oldEmail: string;

  before('configure git author', async () => {
    try {
      oldName = await sh('git config user.name');
    } catch {
      oldName = '';
    }
    try {
      oldEmail = await sh('git config user.email');
    } catch {
      oldEmail = '';
    }
    await sh(`git config user.name "${name}"`);
    await sh(`git config user.email "${email}"`);
  });

  after('restore git author', async () => {
    if (oldName) {
      await sh(`git config user.name "${oldName}"`);
    }
    if (oldEmail) {
      await sh(`git config user.email "${oldEmail}"`);
    }
  });

  return name;
}

function useTempGitBranch(): string {
  const branch = `test-setup-${Math.floor(Math.random() * 1E6)}`;

  before('checkout new git branch', async () => {
    await sh(`git checkout -b ${branch}`);
  });

  after('revert to base branch', async function () {
    this.timeout(60_000);
    console.log('    reverting changes...');
    await sh('git reset --hard');
    await sh(`git checkout ${baseBranch}`);
    await sh(`git branch -D ${branch}`);
    await sh('npm i');
    if (process.stdout.isTTY) {
      process.stdout.moveCursor(0, -1);
      process.stdout.clearLine(0);
    }
  });

  return branch;
}

async function run(answers: Partial<Answers>): Promise<string> {
  const oldConsoleLog = console.log;
  const oldChalkLevel = chalk.level;
  const output: any[][] = [];
  console.log = (...args) => output.push(args);
  chalk.level = 0;
  try {
    await setup(answers);
  } finally {
    console.log = oldConsoleLog;
    chalk.level = oldChalkLevel;
  }
  const result = output
    .map((line) => `${line.map((it) => `${it}`).join(' ')}\n`)
    .join('');
  // log it for debugging when something goes wrong
  console.log(`output: ${result}\n`);
  return result;
}

describe('setup script', () => {
  const author = useTempGitAuthor();

  saveGitState();

  describe('defaults', () => {
    const branch = useTempGitBranch();

    let result: string;

    before('run setup script', async function () {
      this.timeout(60_000);
      result = await run({
        semanticRelease: true,
      });
    });

    it('should default package name to the directory name', () => {
      const dir = basename(dirname(dirname(fileURLToPath(import.meta.url))));
      expect(result).to.contain(`? Package name: ${dir}\n`);
    });

    it('should not provide a default description', () => {
      expect(result).to.contain('? Description: \n');
    });

    it('should default author to the git username', () => {
      expect(result).to.contain(`? Author: ${author}\n`);
    });

    it('should default license to MIT', () => {
      expect(result).to.contain('? License: MIT\n');
    });

    it('should default repository to the git remote', async () => {
      const gitRemote = await sh('git remote get-url origin');
      expect(result).to.contain(`? Repository: ${gitRemote}\n`);
    });

    it('should default package access to "public"', async () => {
      expect(result).to.contain('? Package access: public\n');
    });

    it('should default the release branch to the current git branch', () => {
      expect(result).to.contain(`? Main release branch: ${branch}\n`);
    });

    it('should commit by default', () => {
      expect(result).to.contain('? Commit these changes when done? Yes\n');
    });

    it('should install Semantic Release', () => {
      const packageJson = JSON.parse(readFileSync('package.json').toString());
      expect(packageJson.devDependencies).to.have.property('semantic-release');
    });

    it('should create a .releaserc file', () => {
      const releaseConfig = readFileSync('.releaserc.yml').toString();
      expect(releaseConfig).to.contain(branch);
    });

    it('should commit changes', async () => {
      const gitLog = await sh(`git log --oneline ${baseBranch}..HEAD`);
      const lines = gitLog.split('\n');
      expect(lines).to.have.length(1);
      expect(lines[0]).to.contain('Configure template');
    });

    it('should not leave uncommitted files', async () => {
      const gitStatus = await sh('git status --porcelain');
      expect(gitStatus).to.be.empty;
    });
  });

  describe('changes to package.json', () => {
    const params = {
      name: 'example-name',
      author: 'Example Author',
      description: 'An example package',
      license: 'example-license',
      repository: 'https://example.com/package',
      access: 'restricted',
    };

    useTempGitBranch();

    let packageJson: any;

    before('run setup script', async function () {
      this.timeout(60_000);
      await run({
        packageName: params.name,
        packageAuthor: params.author,
        packageDescription: params.description,
        packageLicense: params.license,
        packageRepository: params.repository,
        packagePublishConfigAccess: params.access,
        semanticRelease: false,
        commit: false,
      });
    });

    before('read package.json', () => {
      packageJson = JSON.parse(readFileSync('package.json').toString());
    });

    it('should set name', () => {
      expect(packageJson.name).to.equal(params.name);
    });

    it('should set author', () => {
      expect(packageJson.author).to.equal(params.author);
    });

    it('should set description', () => {
      expect(packageJson.description).to.equal(params.description);
    });

    it('should set license', () => {
      expect(packageJson.license).to.equal(params.license);
    });

    it('should set repository', () => {
      expect(packageJson.repository.url).to.equal(`git+${params.repository}`);
    });

    it('should set package access', () => {
      expect(packageJson.publishConfig.access).to.equal(params.access);
    });
  });

  describe('no Semantic Release', () => {
    useTempGitBranch();

    let result: string;

    before('run setup script', async function () {
      this.timeout(60_000);
      result = await run({
        semanticRelease: false,
      });
    });

    it('should say no to Semantic Release', () => {
      expect(result).to.contain('? Set up Semantic Release? No\n');
    });

    it('should not ask about the release branch', () => {
      expect(result).not.to.contain('? Main release branch:');
    });

    it('should not install Semantic Release', () => {
      const packageJson = JSON.parse(readFileSync('package.json').toString());
      expect(packageJson.devDependencies).not.to.have.property('semantic-release');
    });

    it('should not create a .releaserc file', () => {
      expect(existsSync('.releaserc.yml'), 'file exists').to.be.false;
    });
  });

  describe('no commit', () => {
    useTempGitBranch();

    let result: string;

    before('run setup script', async function () {
      this.timeout(60_000);
      result = await run({
        semanticRelease: true,
        commit: false,
      });
    });

    it('should say no to commit', () => {
      expect(result).to.contain('? Commit these changes when done? No\n');
    });

    it('should not create any new commits', async () => {
      const gitLog = await sh(`git log --oneline ${baseBranch}..HEAD`);
      expect(gitLog).to.be.empty;
    });

    it('should leave changes uncommitted', async () => {
      const gitStatus = await sh('git status --porcelain', { trim: false });
      expect(gitStatus).to.equal([
        ' M .github/workflows/main.yml',
        'A  .github/workflows/pr.yml',
        ' M .nycrc.yml',
        'A  .releaserc.yml',
        ' M README.md',
        ' M package-lock.json',
        ' M package.json',
        ' D scripts/.eslintrc.yml',
        ' D scripts/set-up-semantic-release.ts',
        ' D scripts/setup.ts',
        ' D tests/setup.spec.ts',
      ].map((it) => `${it}\n`).join(''));
    });
  });
});
