import { LogoBase } from './logo-base';
import { Timestampable } from './timestampable';

export interface Logo extends LogoBase, Timestampable {
  logoId: string;
  levelId: string;
  obfuscatedImageUrl: string;
  realImageUrl: string;
  name: string;
  letters: string;
  obfuscatedName?: string;
  validated?: boolean;
}
