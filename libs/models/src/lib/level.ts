import { CreateLevelDto } from './create-level.dto';
import { Logo } from './logo';
import { Timestampable } from './timestampable';

export interface Level extends CreateLevelDto, Timestampable {
  levelId: string;
  difficulty: number;
  name: string;
  scoreToUnlock: number;
  logos?: Logo[]; // Populated from Logo table via GSI
}
