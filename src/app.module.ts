import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GatewayIntentBits } from 'discord.js';
import { NecordModule } from 'necord';

import { DiscordModule } from './discord/discord.module';
import { MistralModule } from './mistral/mistral.module';
import { TlModule } from './tl/tl.module';
@Module({
  imports: [
    ConfigModule.forRoot({ cache: false, isGlobal: true }),
    ScheduleModule.forRoot(),
    NecordModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg) => ({
        token: cfg.get('DISCORD_TOKEN'),
        intents: [GatewayIntentBits.Guilds],
        development: [cfg.get('DISCORD_DEV_GUILD_ID')],
      }),
    }),
    MistralModule,
    DiscordModule,
    TlModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
