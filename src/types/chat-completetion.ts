import {
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from '@mistralai/mistralai/models/components';

export interface ChatCompletionRequest {
  messages: Array<
    | (SystemMessage & { role: 'system' })
    | (UserMessage & { role: 'user' })
    | (AssistantMessage & { role: 'assistant' })
    | (ToolMessage & { role: 'tool' })
  >;
  temperature?: number;
}
