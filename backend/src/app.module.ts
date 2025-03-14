import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AnalyzeModule } from './analyze/analyze.module';

@Module({
  imports: [AnalyzeModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
