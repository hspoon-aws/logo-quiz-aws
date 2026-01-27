import { Body, Controller, Get, Param, Post, Inject } from '@nestjs/common';
import { LogoService } from '../../shared/service/logo.service';
import { CreateLogoDto, Logo, LogoVerifyResponse } from '@logo-quiz/models';
import { LevelService } from '../../shared/service/level.service';

@Controller('logos')
export class LogoController {
  constructor(
    @Inject(LogoService) private readonly logoService: LogoService,
    @Inject(LevelService) private readonly levelService: LevelService,
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
    const logoObject = logo.toJSON() as Logo;
    const level = await this.levelService.findOne(logoObject.level);
    // Normalize by removing spaces for more forgiving comparison
    const normalizedGuess = guess.toLowerCase().replace(/\s/g, '');
    const normalizedName = logoObject.name.toLowerCase().replace(/\s/g, '');
    const status = normalizedName === normalizedGuess;

    return {
      status,
      realImageUrl: status ? logoObject.realImageUrl : '',
      nextLogo: null,
      isGameCompleted: false,
      level: {
        validLogos: 0,
        totalLogos: level.logos.length,
      },
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Logo> {
    const logo = await this.logoService.findOne(id);
    const logoPayload = logo.toJSON() as Logo;
    let obfuscatedName = logoPayload.name.toLowerCase().replace(/[a-z]/gi, '*');
    obfuscatedName = obfuscatedName.replace(/ /g, '_');
    logoPayload.obfuscatedName = obfuscatedName;
    // For no-auth mode, always show obfuscated
    delete logoPayload.realImageUrl;
    delete logoPayload.name;
    return logoPayload;
  }
}
