import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, map, catchError } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class InstrumentsService {
  private readonly logger = new Logger(InstrumentsService.name);
  private readonly fintachartsInstrumentsBaseUrl = 'https://platform.fintacharts.com/api/instruments/v1/instruments';

  constructor(private readonly httpService: HttpService) {}

  async getInstruments(token: string, provider: string, kind: string): Promise<any> {
    const url = `${this.fintachartsInstrumentsBaseUrl}?provider=${provider}&kind=${kind}`;
    this.logger.log(`Запрос инструментов: ${url}`);

    try {
      const response = await lastValueFrom(
        this.httpService.get(
          url,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        ).pipe(
          map((res: AxiosResponse) => res.data),
          catchError(error => {
            this.logger.error('Ошибка при запросе к Fintacharts Instruments API:', error.response?.data || error.message);
            throw new InternalServerErrorException(error.response?.data || 'Ошибка при получении инструментов от Fintacharts');
          })
        )
      );
      this.logger.log('Инструменты успешно получены.');
      return response;
    } catch (error) {
      throw error;
    }
  }
}
