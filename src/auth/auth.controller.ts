import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: Record<string, string>): Promise<any> {
    const { username, password } = body;
    this.logger.log(`Попытка входа для пользователя: ${username}`);

    if (!username || !password) {
      this.logger.warn('Отсутствует имя пользователя или пароль.');
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Необходимо указать имя пользователя и пароль.' };
    }

    try {
      const tokenResponse = await this.authService.getToken(username, password);
      this.logger.log(`Токен успешно получен для пользователя: ${username}`);
      return tokenResponse;
    } catch (error) {
      this.logger.error(`Ошибка входа для пользователя ${username}: ${error.message}`, error.stack);
      throw error;
    }
  }
}