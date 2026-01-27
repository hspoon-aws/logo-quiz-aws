import { CreateUserDto } from './create-user.dto';
import { Timestampable } from './timestampable';

export interface User extends CreateUserDto, Timestampable {
  userId: string;
  email: string;
  password: string;
  stateId?: string;
  lastAccessAt?: Date;
}

export interface UserState extends Timestampable {
  stateId: string;
  userId: string;
  logos: string[]; // Array of logoIds
}

export interface UserCompletedLogo extends Timestampable {
  id: string;
  stateId: string;
  logoId: string;
}
