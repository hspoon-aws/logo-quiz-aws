import { Body, Controller, Get, Param, Post, Logger, Inject } from '@nestjs/common';
import { LevelService } from '../../shared/service/level.service';
import { CreateLevelDto, Level } from '@logo-quiz/models';

@Controller('levels')
export class LevelController {
  private readonly logger = new Logger('LevelController');

  constructor(@Inject(LevelService) private readonly levelService: LevelService) {
    this.logger.log(`LevelService injected: ${!!this.levelService}`);
  }

  @Post()
  async create(@Body() createLevelDto: CreateLevelDto) {
    return await this.levelService.create(createLevelDto);
  }

  @Get()
  async findAll(): Promise<Level[]> {
    this.logger.log(`findAll called, levelService: ${!!this.levelService}`);
    return await this.levelService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Level> {
    return await this.levelService.findOne(id, 'obfuscatedImageUrl realImageUrl');
  }
}
