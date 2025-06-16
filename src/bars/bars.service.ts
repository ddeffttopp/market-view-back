import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, map, catchError } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class BarsService {
  private readonly logger = new Logger(BarsService.name);
  private readonly fintachartsBarsBaseUrl = 'https://platform.fintacharts.com/api/bars/v1/bars/count-back';

  constructor(private readonly httpService: HttpService) {}

  async getBars(
    token: string,
    instrumentId: string,
    provider: string,
    interval: number,
    periodicity: string,
    barsCount: number,
  ): Promise<any> {
    const url = `${this.fintachartsBarsBaseUrl}`;
    this.logger.log(`Запрос баров: ${url} с параметрами: instrumentId=${instrumentId}, provider=${provider}, interval=${interval}, periodicity=${periodicity}, barsCount=${barsCount}`);

    try {
      const response = await lastValueFrom(
        this.httpService.get(
          url,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            params: {
              instrumentId,
              provider,
              interval,
              periodicity,
              barsCount
            }
          }
        ).pipe(
          map((res: AxiosResponse) => res.data),
          catchError(error => {
            this.logger.error('Ошибка при запросе к Fintacharts Bars API:', error.response?.data || error.message);
            throw new InternalServerErrorException(error.response?.data || 'Ошибка при получении данных баров от Fintacharts');
          })
        )
      );
      this.logger.log('Данные баров успешно получены.');
      return response;
    } catch (error) {
      throw error;
    }
  }
}
