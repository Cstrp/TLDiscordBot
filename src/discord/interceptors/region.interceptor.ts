import { Injectable } from '@nestjs/common';
import { AutocompleteInteraction } from 'discord.js';
import { AutocompleteInterceptor } from 'necord';
import { REGIONS } from 'src/enums/regions';

@Injectable()
export class RegionAutocompleteInterceptor extends AutocompleteInterceptor {
  public transformOptions(
    interaction: AutocompleteInteraction,
  ): void | Promise<void> {
    const focused = interaction.options.getFocused(true);
    let choices: string[] = [];

    if (focused.name === 'region') {
      choices = [...Object.values(REGIONS)];
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
