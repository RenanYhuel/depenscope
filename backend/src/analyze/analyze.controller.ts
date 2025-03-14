import { Controller, Post, Body } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post()
  async analyze(@Body('repoUrl') repoUrl: string): Promise<string> {
    if (!repoUrl) {
      throw new Error('Le champ repoUrl ne peut pas être vide');
    }
    return this.analyzeService.analyze(repoUrl);
  }
}
