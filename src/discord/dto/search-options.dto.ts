import { StringOption } from 'necord';

export class SearchOptionsDto {
  @StringOption({
    name: 'query',
    description: 'Enter the value (search query) for AI assistant:',
  })
  query: string;
}
