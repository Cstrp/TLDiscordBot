import { Injectable } from '@nestjs/common';
import { AutocompleteInteraction } from 'discord.js';
import { AutocompleteInterceptor } from 'necord';
import { CATEGORY } from 'src/enums/category';

@Injectable()
export class CategoryAutocompleteInterceptor extends AutocompleteInterceptor {
  public transformOptions(
    interaction: AutocompleteInteraction,
  ): void | Promise<void> {
    const focused = interaction.options.getFocused(true);
    let choices: string[] = [];

    if (focused.name === 'category') {
      choices = [...Object.values(CATEGORY)];
    }

    return interaction.respond(
      choices
        .filter((choice) => choice.includes(focused.value.toString()))
        .map((choice) => ({
          name: choice.toUpperCase(),
          value: choice,
        })),
    );
  }
}
