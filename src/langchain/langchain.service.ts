import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatMistralAI, ChatMistralAICallOptions } from '@langchain/mistralai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { search } from 'duck-duck-scrape';
import { CONDENSE_TEMPLATE, QA_TEMPLATE } from './templates';

@Injectable()
export class LangchainService implements OnModuleInit {
  private readonly logger: Logger = new Logger(LangchainService.name);
  private chatMistralAI: ChatMistralAI<ChatMistralAICallOptions>;

  constructor(private readonly cfg: ConfigService) {}

  public async onModuleInit() {
    this.chatMistralAI = this.initializeChatMistralAI();
  }

  public async askQuestion(query: string): Promise<string> {
    const chain = this.makeChain();
    try {
      const responseStream = await chain.stream({ question: query });
      let answer = '';
      for await (const chunk of responseStream) {
        answer += chunk;
      }
      this.logger.verbose(`Generated answer for query "${query}": ${answer}`);
      return answer;
    } catch (error) {
      this.logger.error(
        `Error processing query "${query}": ${error.message}`,
        error.stack,
      );
      return 'Извините, не удалось получить ответ. Попробуйте позже.';
    }
  }

  private makeChain() {
    const condenseQuestionPrompt =
      ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);
    const qaPrompt = ChatPromptTemplate.fromTemplate(QA_TEMPLATE);
    const parser = new StringOutputParser();

    type QuestionChainOutput = { detectedLang: string; question: string };

    const questionChain = condenseQuestionPrompt
      .pipe(this.chatMistralAI)
      .pipe(parser)
      .pipe((response: string): QuestionChainOutput => {
        const lines = response.split('\n');
        const langCode =
          lines
            .find((line) => line.startsWith('Language:'))
            ?.split(':')[1]
            ?.trim() || 'en';

        const question =
          lines
            .find((line) => line.startsWith('Question:'))
            ?.split(':')
            .slice(1)
            .join(':')
            .trim() || response;

        return { detectedLang: langCode, question };
      });

    type AnswerChainInput = { question: string; detectedLang: string };

    const answerChain = RunnableSequence.from([
      {
        context: async (input: AnswerChainInput) => {
          const searchResults = await search(input.question, { safeSearch: 0 });
          const context = searchResults.results
            .slice(0, 5)
            .map((result) => `${result.title}: ${result.description}`)
            .join('\n');
          return context || 'Релевантные результаты поиска не найдены.';
        },
        question: (input: AnswerChainInput) => input.question,
        detectedLang: (input: AnswerChainInput) => input.detectedLang,
      },
      qaPrompt,
      this.chatMistralAI,
      parser,
    ]);

    return RunnableSequence.from([
      questionChain,
      async (input: QuestionChainOutput) => {
        const { detectedLang, question } = input;
        this.logger.debug(
          `Detected language: ${detectedLang}, Refined question: ${question}`,
        );
        return answerChain.invoke({ question, detectedLang });
      },
    ]);
  }

  private initializeChatMistralAI(): ChatMistralAI<ChatMistralAICallOptions> {
    const apiKey = this.cfg.get<string>('MISTRAL_TOKEN');
    const modelName = this.cfg.get<string>('MISTRAL_MODEL');

    if (!apiKey || !modelName) {
      throw new Error(
        'Mistral API key or model name is not configured. Check your .env file.',
      );
    }

    return new ChatMistralAI({ apiKey, modelName, temperature: 0.3 });
  }
}
