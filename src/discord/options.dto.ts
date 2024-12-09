import { StringOption } from 'necord';
import { REGIONS } from 'src/enums/regions';

export class RegionOptionsDto {
  @StringOption({
    name: 'region',
    description: 'Select a region',
    autocomplete: true,
    required: true,
  })
  region: keyof typeof REGIONS;
}
