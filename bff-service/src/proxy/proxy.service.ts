import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async forwardRequest(
    serviceName: string,
    method: string,
    path: string,
    query: any,
    body: any,
    headers: any,
  ): Promise<{
    status: number;
    data: any;
    headers: Record<string, string | string[]>;
  }> {
    const serviceUrl = this.configService.get<string>(
      `services.${serviceName}`,
    );

    if (!serviceUrl) {
      throw new HttpException('Cannot process request', 502);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${serviceUrl}${path}`,
          params: query,
          data: body,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BFF-Service',
            Accept: '*/*',
            ...(headers.authorization && {
              authorization: headers.authorization,
            }),
          },
          validateStatus: () => true, // Allow any status code
        }),
      );

      return {
        status: response.status,
        data: response.data,
        headers: Object.fromEntries(Object.entries(response.headers)),
      };
    } catch (error) {
      console.error(JSON.stringify(error));
      if (error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }
      throw new HttpException('Service unavailable', 503);
    }
  }
}
