import { StringOption } from 'necord';
import { CATEGORY } from 'src/enums/category';

export class CategoryOptionsDto {
  @StringOption({
    name: 'category',
    description: 'Select a news category',
    autocomplete: true,
    required: true,
  })
  category: keyof typeof CATEGORY;
}
