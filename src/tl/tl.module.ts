import { Module } from '@nestjs/common';
import { TlService } from './tl.service';

@Module({
  controllers: [],
  providers: [TlService],
})
export class TlModule {}
