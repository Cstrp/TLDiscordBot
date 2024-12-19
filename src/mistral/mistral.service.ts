import { Mistral } from '@mistralai/mistralai';
import { ContentChunk } from '@mistralai/mistralai/models/components';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequest } from 'src/types/chat-completetion';

@Injectable()
export class MistralService implements OnModuleInit {
  private readonly logger: Logger = new Logger(MistralService.name);

  private client: Mistral;

  constructor(private readonly cfg: ConfigService) {}

  public onModuleInit() {
    const apiKey = this.cfg.get<string>('MISTRAL_TOKEN');

    this.client = new Mistral({ apiKey });
  }

  public async translateNews(text: string): Promise<string> {
    const prompt = this.cfg.get<string>('MISTRAL_TRANSLATE_PROMPT') ?? '';
    const messages = [
      { role: 'user', content: prompt },
      { role: 'system', content: text.trim() },
    ] as ChatCompletionRequest['messages'];

    const response = await this.createChatCompletion({
      messages,
    });

    const translatedText =
      typeof response === 'string' ? response : response.join('\n');

    this.logger.log(JSON.stringify(translatedText));

    return translatedText;
  }

  private async createChatCompletion({
    messages,
    temperature,
  }: ChatCompletionRequest): Promise<string | ContentChunk[]> {
    const model = this.cfg.get<string>('MISTRAL_MODEL') ?? '';

    const response = await this.client.chat.complete({
      model,
      temperature,
      messages,
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    return content;
  }
}
