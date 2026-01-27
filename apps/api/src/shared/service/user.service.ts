import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto, User } from '@logo-quiz/models';
import { Model, QueryFindOneAndUpdateOptions } from 'mongoose';
import { passwordHash } from '../utils/password-hash';

@Injectable()
export class UserService {
  constructor(
    @Inject('USER_MODEL') private readonly userModel: Model<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const instance = new this.userModel(createUserDto);
    return await instance.save();
  }

  async findAll(): Promise<User[]> {
    return await this.userModel.find().exec();
  }

  async findOne(id: string): Promise<User> {
    return await this.userModel.findById(id);
  }

  async findOneAndUpdate(
    id: string,
    payload: any = {},
    updateOpts: QueryFindOneAndUpdateOptions = { new: true },
  ): Promise<User> {
    return await this.userModel.findByIdAndUpdate(id, payload, updateOpts);
  }

  async login(credentials: { email: string; password: string }) {
    const user = await this.userModel.findOne({
      email: credentials.email,
      password: passwordHash(credentials.password),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async signup(credentials: { email: string; password: string }) {
    const user = {
      email: credentials.email,
      password: passwordHash(credentials.password),
    };
    const instance = new this.userModel(user);
    return await instance.save();
  }
}
