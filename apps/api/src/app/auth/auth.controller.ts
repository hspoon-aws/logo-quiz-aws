import { Controller, Post, Body, Inject } from '@nestjs/common';
import { AuthService } from '../../shared/service/auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('token')
  public async getToken(@Body() credentials: { email: string; password: string }) {
    return await this.authService.createToken(credentials);
  }
}
