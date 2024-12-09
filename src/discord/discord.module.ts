import { Module } from '@nestjs/common';
import { TlService } from 'src/tl/tl.service';
import { DiscordService } from './discord.service';

@Module({
  imports: [],
  providers: [DiscordService, TlService],
})
export class DiscordModule {}
