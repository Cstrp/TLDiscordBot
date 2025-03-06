import { Module } from '@nestjs/common';
import { MistralService } from './mistral.service';

@Module({
  providers: [MistralService],
  exports: [],
})
export class MistralModule {}
