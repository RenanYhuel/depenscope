import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeController } from '../src/analyze/analyze.controller';

describe('AnalyzeController', () => {
  let controller: AnalyzeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyzeController],
    }).compile();

    controller = module.get<AnalyzeController>(AnalyzeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return "Analysis complete"', () => {
    expect(controller.analyze()).toBe('Analysis complete');
  });
});
