import { Module } from '@nestjs/common';
import { MistralService } from 'src/mistral/mistral.service';
import { TlService } from 'src/tl/tl.service';
import { DiscordService } from './discord.service';
import { CategoryAutocompleteInterceptor } from './interceptors/category.interceptor';
import { RegionAutocompleteInterceptor } from './interceptors/region.interceptor';

@Module({
  providers: [
    DiscordService,
    TlService,
    MistralService,
    RegionAutocompleteInterceptor,
    CategoryAutocompleteInterceptor,
  ],
})
export class DiscordModule {}
