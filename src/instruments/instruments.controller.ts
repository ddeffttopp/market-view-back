import { Controller, Get, Headers, Query, Logger, HttpStatus } from '@nestjs/common';
import { InstrumentsService } from './instruments.service';

@Controller('instruments')
export class InstrumentsController {
  private readonly logger = new Logger(InstrumentsController.name);

  constructor(private readonly instrumentsService: InstrumentsService) {}

  @Get()
  async getInstruments(
    @Headers('authorization') authorization: string,
    @Query('provider') provider: string = 'oanda',
    @Query('kind') kind: string = 'forex',
  ): Promise<any> {
    this.logger.log(`Получен запрос на получение инструментов.`);

    if (!authorization) {
      this.logger.warn('Отсутствует заголовок авторизации.');
      return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Authorization header is missing.' };
    }

    const token = authorization.replace('Bearer ', '');

    if (!token) {
      this.logger.warn('Токен авторизации отсутствует.');
      return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Bearer token is missing.' };
    }

    try {
      const instruments = await this.instrumentsService.getInstruments(token, provider, kind);
      this.logger.log('Инструменты успешно возвращены.');
      return instruments;
    } catch (error) {
      this.logger.error(`Ошибка при получении инструментов: ${error.message}`, error.stack);
      throw error;
    }
  }
}
