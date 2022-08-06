#!/usr/bin/env npx ts-node
import { ExecOptions, exec } from 'child_process';
import { rmSync, writeFileSync } from 'fs';
import { basename, dirname } from 'path';

import chalk from 'chalk';
import inquirer from 'inquirer';

import { setUpSemanticRelease } from './set-up-semantic-release';

export type Answers = {
  packageName: string;
  packageDescription: string;
  packageAuthor: string;
  packageLicense: string;
  packageRepository: string;
  semanticRelease: boolean;
  semanticReleaseBranch: string;
  commit: boolean;
};

const warnings: string[] = [];

export function sh(cmd: string, options?: ExecOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout && stdout.toString().trim());
      }
    });
  });
}

export function warn(msg: string) {
  console.log(`  ${chalk.red(msg)}`);
  warnings.push(msg);
}

export async function step(name: string, action: () => void | Promise<void>) {
  console.log(chalk.yellowBright(`- ${name}`));
  try {
    await action();
  } catch (error) {
    warn((error as Error).message);
  }
}

(async () => {
  const rootDir = dirname(__dirname);
  process.chdir(rootDir);

  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const packageJson = require('../package.json');
  const gitUsername = await sh('git config user.name');
  const gitRemote = await sh('git remote get-url origin');
  const gitBranch = await sh('git rev-parse --abbrev-ref HEAD');

  const answers = await inquirer.prompt<Answers>([
    {
      type: 'input',
      name: 'packageName',
      message: 'Package name:',
      default: basename(rootDir),
    },
    {
      type: 'input',
      name: 'packageDescription',
      message: 'Description:',
    },
    {
      type: 'input',
      name: 'packageAuthor',
      message: 'Author:',
      default: gitUsername,
    },
    {
      type: 'input',
      name: 'packageLicense',
      message: 'License:',
      default: packageJson.license,
    },
    {
      type: 'input',
      name: 'packageRepository',
      message: 'Repository:',
      default: gitRemote,
    },
    {
      type: 'confirm',
      name: 'semanticRelease',
      message: 'Set up Semantic Release?',
    },
    {
      type: 'input',
      name: 'semanticReleaseBranch',
      message: 'Main release branch:',
      default: gitBranch,
      when: (ans) => ans.semanticRelease,
    },
    {
      type: 'confirm',
      name: 'commit',
      message: 'Commit these changes when done?',
      default: true,
    },
  ]);

  let nextSteps = [
    `Add your code in ${chalk.blueBright('src')}`,
    `Add your tests in ${chalk.blueBright('tests')}`,
  ];

  console.log();

  await step('Updating package.json', () => {
    packageJson.name = answers.packageName;
    packageJson.description = answers.packageDescription;
    packageJson.author = answers.packageAuthor;
    packageJson.license = answers.packageLicense;
    packageJson.name = answers.packageName;
    writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  });

  await step('Removing scripts', async () => {
    const dependencies = [
      'inquirer',
      '@types/inquirer',
      'chalk',
      '@octokit/rest',
    ];
    rmSync('scripts', { recursive: true });
    await sh(`npm un ${dependencies.join(' ')}`);
  });

  await step('Replacing README', () => {
    const content = [
      `# ${answers.packageName}\n`,
      `${answers.packageDescription}\n`,
      '## Usage\n',
      'Tell people how to install and use your package.\n',
      '## Development\n',
      '### Linting\n',
      'Check for consistent code style by running `npm run lint`.\n',
      '### Testing\n',
      'Run all tests using `npm test`, or `npm run coverage` to see test coverage.\n',
    ].join('\n');
    writeFileSync('README.md', content);
  });

  if (answers.semanticRelease) {
    const steps = await setUpSemanticRelease(answers);
    nextSteps = nextSteps.concat(steps);
  }

  if (answers.commit) {
    await step('Committing changes', async () => {
      await sh('git commit -a -m "Configure template"');
    });
  }

  if (warnings.length === 0) {
    console.log(`\n${chalk.greenBright.bold('✔ All set up!')}\n`);
  } else {
    console.log(`\n${chalk.redBright.bold('! Finished with warnings')}\n`);
  }

  console.log('Next steps:\n');
  console.log(`- ${nextSteps.join('\n- ')}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
