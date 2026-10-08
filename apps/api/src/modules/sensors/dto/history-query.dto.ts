import { Transform } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

const toNumber = ({ value }: { value: unknown }): number => Number(value);

export class HistoryQueryDto {
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(168)
  hours = 24;

  @Transform(toNumber)
  @IsInt()
  @IsIn([5, 15, 30, 60])
  interval = 60;
}
