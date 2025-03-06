import { StringOption } from 'necord';

export class ScheduleOptionsDto {
  @StringOption({
    name: 'schedule',
    description: 'Select a schedule type (rain or night)',
    autocomplete: true,
    required: true,
  })
  type: 'rain' | 'night';
}
