import * as prettier from 'prettier/standalone';
import * as babel from 'prettier/plugins/babel';
import * as estree from 'prettier/plugins/estree';

export async function formatProgram(source) {
  return prettier.format(source, {
    parser: 'babel',
    plugins: [babel, estree],
    arrowParens: 'always',
    bracketSpacing: true,
    printWidth: 100,
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'all',
    useTabs: false,
  });
}
