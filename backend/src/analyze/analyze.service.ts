import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import * as tmp from 'tmp';

interface Dependency {
	file?: string;
	package?: string;
	version?: string;
	type: 'direct';
}

interface FileDependencies {
	dependencies: {
		internal: Dependency[];
		external: Dependency[];
	};
	extension: string;
	type: 'TypeScript' | 'JavaScript';
}

@Injectable()
export class AnalyzeService {
    async analyze(repoUrl: string): Promise<string> {
        let tmpDir: tmp.DirResult | undefined;
        try {
            tmpDir = await this.cloneGitHubRepo(repoUrl);
        } catch (error: unknown) {
            console.error(
                'Error cloning GitHub repo:',
                error instanceof Error ? error.message : 'Erreur inconnue',
            );
            return '';
        }

        if (!tmpDir) {
            console.error('Temporary directory not created');
            return '';
        }

        const projectRoot = tmpDir.name;
        const files = this.getFilesInDirectory(projectRoot);
        const result: Record<string, FileDependencies> = {};

        files.forEach((filePath) => {
            const relativePath = path.relative(projectRoot, filePath);
            const directories = relativePath.split(path.sep);
            const fileName = directories.pop() || '';

            const dependencies = this.analyzeFile(filePath);
            let currentDir: Record<string, FileDependencies | Record<string, FileDependencies>> = result;

            directories.forEach((dir) => {
                if (!currentDir[dir]) {
                    currentDir[dir] = { dependencies: { internal: [], external: [] }, extension: '', type: 'TypeScript' };
                }
                currentDir = currentDir[dir] as Record<string, FileDependencies | Record<string, FileDependencies>>;
            });

            if (currentDir && typeof currentDir === 'object' && !Array.isArray(currentDir)) {
                (currentDir as Record<string, FileDependencies>)[fileName] = {
                    dependencies,
                    extension: path.extname(filePath),
                    type: fileName.includes('.tsx') || fileName.includes('.ts') ? 'TypeScript' : 'JavaScript',
                };
            }
        });

        try {
            tmpDir.removeCallback();
        } catch (error) {
            if (error instanceof Error && (error as any).code !== 'ENOTEMPTY') {
                console.error('Error removing temporary directory:', error.message);
            }
        }

        return JSON.stringify(result, null, 2);
    }

	private getFilesInDirectory(dir: string): string[] {
			let results: string[] = [];
			const list = fs.readdirSync(dir);
			list.forEach((file) => {
				const filePath = path.join(dir, file);
			const stat = fs.statSync(filePath);
			if (stat.isDirectory()) {
				if (file === 'node_modules') return;
				results = results.concat(this.getFilesInDirectory(filePath));
			} else if (file.match(/\.(js|jsx|ts|tsx)$/)) {
				results.push(filePath);
			}
		});
		return results;
	}

	private analyzeFile(filePath: string): {
		internal: Dependency[];
		external: Dependency[];
	} {
		const code = fs.readFileSync(filePath, 'utf-8');
		const dependencies = {
			internal: [] as Dependency[],
			external: [] as Dependency[],
		};

		try {
			const ast = parser.parse(code, {
				sourceType: 'module',
				plugins: ['jsx', 'typescript'],
			});

			ast.program.body.forEach((node: any) => {
				if (node.type === 'ImportDeclaration') {
					const importSource = node.source.value;

					if (importSource.startsWith('.') || importSource.startsWith('..')) {
						dependencies.internal.push({
							file: importSource,
							type: 'direct',
						});
					} else {
						dependencies.external.push({
							package: importSource,
							version: 'unknown',
							type: 'direct',
						});
					}
				}
			});
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error parsing file ${filePath}:`, error.message);
			}
		}

		return dependencies;
	}

	private async cloneGitHubRepo(repoUrl: string): Promise<tmp.DirResult> {
		const tmpDir: tmp.DirResult = tmp.dirSync();
		const git = require('simple-git')(tmpDir.name);
		try {
			await git.clone(repoUrl);
		} catch (error) {
			if (error instanceof Error) {
				console.error('Git clone error:', error.message);
			} else {
				console.error('Unknown error during git clone');
			}
		}
		return tmpDir;
	}
}
