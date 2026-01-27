import { Body, Controller, Get, Param, Post, Inject, forwardRef } from '@nestjs/common';
import { LogoService } from '../../shared/service/logo.service';
import { CreateLogoDto, Logo, LogoVerifyResponse } from '@logo-quiz/models';
import { LevelService } from '../../shared/service/level.service';

@Controller('logos')
export class LogoController {
  constructor(
    @Inject(forwardRef(() => LogoService)) private readonly logoService: LogoService,
    @Inject(forwardRef(() => LevelService)) private readonly levelService: LevelService,
  ) {}

  @Post()
  async create(@Body() createLogoDto: CreateLogoDto) {
    return await this.logoService.create(createLogoDto);
  }

  @Get()
  async findAll(): Promise<Logo[]> {
    return this.logoService.findAll();
  }

  @Post(':id/validate')
  async validateGuess(
    @Param('id') id: string,
    @Body() validate: { guess: string },
  ): Promise<LogoVerifyResponse> {
    const guess = validate.guess.replace(/\_/gi, ' ');
    const logo = await this.logoService.findOne(id);
    if (!logo) {
      return {
        status: false,
        realImageUrl: '',
        nextLogo: null,
        isGameCompleted: false,
        level: { validLogos: 0, totalLogos: 0 },
      };
    }

    const level = await this.levelService.findOne(logo.levelId);
    // Normalize by removing spaces for more forgiving comparison
    const normalizedGuess = guess.toLowerCase().replace(/\s/g, '');
    const normalizedName = logo.name.toLowerCase().replace(/\s/g, '');
    const status = normalizedName === normalizedGuess;

    return {
      status,
      realImageUrl: status ? logo.realImageUrl : '',
      nextLogo: null,
      isGameCompleted: false,
      level: {
        validLogos: 0,
        totalLogos: level?.logos?.length || 0,
      },
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Logo | null> {
    const logo = await this.logoService.findOne(id);
    if (!logo) return null;

    // Create a copy for response
    const logoPayload = { ...logo };
    let obfuscatedName = logoPayload.name.toLowerCase().replace(/[a-z]/gi, '*');
    obfuscatedName = obfuscatedName.replace(/ /g, '_');
    logoPayload.obfuscatedName = obfuscatedName;
    // For no-auth mode, always show obfuscated
    logoPayload.realImageUrl = '';
    logoPayload.name = '';
    return logoPayload;
  }
}
