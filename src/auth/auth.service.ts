import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, map, catchError } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class AuthService {
  private readonly fintachartsAuthUrl = 'https://platform.fintacharts.com/identity/realms/fintatech/protocol/openid-connect/token';

  constructor(private readonly httpService: HttpService) {}

  async getToken(username: string, password: string): Promise<any> {
    const body = new URLSearchParams();
    body.append('grant_type', 'password');
    body.append('client_id', 'app-cli');
    body.append('username', username);
    body.append('password', password);

    try {
      const response = await lastValueFrom(
        this.httpService.post(
          this.fintachartsAuthUrl,
          body.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        ).pipe(
          map((res: AxiosResponse) => res.data),
          catchError(error => {
            console.error('Ошибка при запросе к Fintacharts API:', error.response?.data || error.message);
            throw new InternalServerErrorException(error.response?.data || 'Ошибка при получении токена от Fintacharts');
          })
        )
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
}