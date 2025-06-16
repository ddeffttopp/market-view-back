import { Controller, Get, Headers, Query, Logger, HttpStatus } from '@nestjs/common';
import { BarsService } from './bars.service';

@Controller('bars')
export class BarsController {
  private readonly logger = new Logger(BarsController.name);

  constructor(private readonly barsService: BarsService) {}

  @Get('count-back')
  async getBars(
    @Headers('authorization') authorization: string,
    @Query('instrumentId') instrumentId: string,
    @Query('provider') provider: string = 'oanda',
    @Query('interval') interval: number,
    @Query('periodicity') periodicity: string,
    @Query('barsCount') barsCount: number,
  ): Promise<any> {
    this.logger.log(`Получен запрос на получение баров для instrumentId: ${instrumentId}`);

    if (!authorization) {
      this.logger.warn('Отсутствует заголовок авторизации для запроса баров.');
      return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Authorization header is missing.' };
    }

    const token = authorization.replace('Bearer ', '');

    if (!token) {
      this.logger.warn('Токен авторизации отсутствует для запроса баров.');
      return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Bearer token is missing.' };
    }

    try {
      const parsedInterval = parseInt(interval as any, 10);
      const parsedBarsCount = parseInt(barsCount as any, 10);

      const bars = await this.barsService.getBars(
        token,
        instrumentId,
        provider,
        parsedInterval,
        periodicity,
        parsedBarsCount
      );
      this.logger.log('Данные баров успешно возвращены.');
      return bars;
    } catch (error) {
      this.logger.error(`Ошибка при получении баров: ${error.message}`, error.stack);
      throw error;
    }
  }
}
