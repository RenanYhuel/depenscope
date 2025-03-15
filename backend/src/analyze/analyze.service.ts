import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import * as tmp from 'tmp';

type FileType = "folder" | "TypeScript" | "JavaScript" | "HTML" | "CSS" | "Image";

interface Dependency {
  id: number;
  type: 'direct' | 'alias';
  alias?: string;
  package?: string;
  version?: string;
}

interface FileDependencies {
  dependencies: {
    internal: Dependency[];
    external: Dependency[];
  };
  extension?: string;
  type: FileType;
  content?: Record<number, FileDependencies & { name: string }>;
}

@Injectable()
export class AnalyzeService {
  private nextFileId = 1;
  private allEntries = new Map<string, { id: number; type: 'file' | 'folder'; parent?: number }>();

  async analyze(repoUrl: string): Promise<string> {
    let tmpDir: tmp.DirResult | undefined;
    try {
      tmpDir = await this.cloneGitHubRepo(repoUrl);
    } catch (error: unknown) {
      console.error('Error cloning GitHub repo:', error instanceof Error ? error.message : 'Unknown error');
      return '';
    }

    if (!tmpDir) {
      console.error('Temporary directory not created');
      return '';
    }

    const projectRoot = tmpDir.name;
    const result = this.getEntriesInDirectory(projectRoot, null);

    try {
      tmpDir.removeCallback();
    } catch (error) {
      if (error instanceof Error && (error as any).code !== 'ENOTEMPTY') {
        console.error('Error removing temporary directory:', error.message);
      }
    }

    return JSON.stringify(result, null, 2);
  }

  private getEntriesInDirectory(dir: string, parentId: number | null): Record<number, FileDependencies & { name: string }> {
    const content: Record<number, FileDependencies & { name: string }> = {};
    const list = fs.readdirSync(dir);

    list.forEach((file) => {
      if (file === '.git' || file === 'node_modules') return;
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const fileId = this.nextFileId++;

      if (stat.isDirectory()) {
        content[fileId] = {
          name: file,
          dependencies: { internal: [], external: [] },
          type: 'folder',
          content: this.getEntriesInDirectory(filePath, fileId),
        };
      } else {
        content[fileId] = {
            name: file,
            dependencies: this.analyzeFile(filePath),
            extension: path.extname(filePath),
            type: this.getFileType(filePath),
          };
          
    }
    });
    return content;
  }

  getFileType(filePath: string): FileType {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.html') return 'HTML';
    if (ext === '.css') return 'CSS';
    if (ext === '.js' || ext === '.jsx') return 'JavaScript';
    if (ext === '.ts' || ext === '.tsx') return 'TypeScript';
    if (ext === '.jpg' || ext === '.png' || ext === '.ico' || ext === '.svg' || ext === '.gif' || ext === '.jpeg') return 'Image';
    return 'JavaScript';
  }
  
  

  private analyzeFile(filePath: string): { internal: Dependency[]; external: Dependency[] } {
    const ext = path.extname(filePath);
    if (!['.js', '.ts', '.tsx'].includes(ext)) {
      return { internal: [], external: [] };
    }
    const code = fs.readFileSync(filePath, 'utf-8');
    const dependencies = { internal: [] as Dependency[], external: [] as Dependency[] };
    try {
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      ast.program.body.forEach((node: any) => {
        if (node.type === 'ImportDeclaration') {
          const importSource = node.source.value;
          if (importSource.startsWith('.') || importSource.startsWith('..')) {
            dependencies.internal.push({ id: this.nextFileId++, type: 'direct' });
          } else {
            dependencies.external.push({ id: this.nextFileId++, package: importSource, version: 'unknown', type: 'direct' });
          }
        }
      });
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error instanceof Error ? error.message : 'Parsing error');
    }
    return dependencies;
  }

  private async cloneGitHubRepo(repoUrl: string): Promise<tmp.DirResult> {
    const tmpDir: tmp.DirResult = tmp.dirSync();
    const git = require('simple-git')(tmpDir.name);
    try {
      await git.clone(repoUrl);
    } catch (error) {
      console.error('Git clone error:', error instanceof Error ? error.message : 'Unknown error');
    }
    return tmpDir;
  }
}
