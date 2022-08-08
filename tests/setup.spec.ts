import { existsSync, readFileSync } from 'fs';

import { expect } from 'chai';
import chalk from 'chalk';
import inquirer, { Question } from 'inquirer';

import { Answers, setup, sh } from '../scripts/setup';

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

function useTempGitUsername(): string {
  const name = `Test user ${Math.floor(Math.random() * 1E6)}`;
  let oldName: string;

  before('configure git username', async () => {
    oldName = await sh('git config user.name');
    await sh(`git config user.name "${name}"`);
  });

  after('restore git username', async () => {
    await sh(`git config user.name "${oldName}"`);
  });

  return name;
}

function useTempGitBranch(): string {
  const branch = `test-setup-${Math.floor(Math.random() * 1E6)}`;

  before('checkout new git branch', async () => {
    await sh(`git checkout -b ${branch}`);
  });

  after('revert to main branch', async function () {
    this.timeout(60_000);
    console.log('    reverting changes...');
    await sh('git reset --hard');
    await sh('git checkout main');
    await sh(`git branch -D ${branch}`);
    await sh('npm i');
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(0);
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
  return output.map((line) => `${line.map((it) => `${it}`).join(' ')}\n`).join('');
}

describe('setup script', () => {
  const author = useTempGitUsername();

  describe('defaults', () => {
    const branch = useTempGitBranch();

    let result: string;

    before('run setup script', async function () {
      this.timeout(60_000);
      result = await run({
        semanticRelease: true,
      });
    });

    it('should pre-fill everything except description', () => {
      expect(result).to.contain('? Package name: ts-package-template\n');
      expect(result).to.contain('? Description: \n');
      expect(result).to.contain(`? Author: ${author}\n`);
      expect(result).to.contain('? License: MIT\n');
      expect(result).to.contain('? Repository: https://github.com/seb-cr/ts-package-template.git\n');
      expect(result).to.contain('? Set up Semantic Release? Yes\n');
      expect(result).to.contain(`? Main release branch: ${branch}\n`);
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
      const gitLog = await sh('git log --oneline main..HEAD');
      const lines = gitLog.split('\n');
      expect(lines).to.have.length(1);
      expect(lines[0]).to.contain('Configure template');
    });

    it('should not leave uncommitted files', async () => {
      const gitStatus = await sh('git status --porcelain');
      expect(gitStatus).to.be.empty;
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
      const gitLog = await sh('git log --oneline main..HEAD');
      expect(gitLog).to.be.empty;
    });

    it('should leave changes uncommitted', async () => {
      const gitStatus = await sh('git status --porcelain', { trim: false });
      expect(gitStatus).to.equal([
        ' M .github/workflows/main.yml',
        'A  .github/workflows/pr.yml',
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
