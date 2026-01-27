import { Body, Controller, Get, Param, Post, Inject, forwardRef } from '@nestjs/common';
import { LevelService } from '../../shared/service/level.service';
import { CreateLevelDto, Level } from '@logo-quiz/models';

@Controller('levels')
export class LevelController {
  constructor(@Inject(forwardRef(() => LevelService)) private readonly levelService: LevelService) {}

  @Post()
  async create(@Body() createLevelDto: CreateLevelDto) {
    return await this.levelService.create(createLevelDto);
  }

  @Get()
  async findAll(): Promise<Level[]> {
    return await this.levelService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Level> {
    return await this.levelService.findOne(id, 'obfuscatedImageUrl realImageUrl');
  }
}
