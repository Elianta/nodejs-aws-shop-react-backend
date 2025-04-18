import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, HttpException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';

interface IProxyResponse {
  status: number;
  data: any;
  headers: Record<string, string | string[]>;
}

@Injectable()
export class ProxyService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private getCacheKey(serviceName: string, path: string): string {
    return `${serviceName}:${path}`;
  }

  private shouldCacheResponse(
    serviceName: string,
    method: string,
    path: string,
  ): boolean {
    return (
      method === 'GET' && serviceName === 'product' && path === '/products'
    );
  }

  async clearCache(serviceName: string, path: string): Promise<void> {
    const cacheKey = this.getCacheKey(serviceName, path);
    await this.cacheManager.del(cacheKey);
    console.log('Cleared cache for:', cacheKey);
  }

  async forwardRequest(
    serviceName: string,
    method: string,
    path: string,
    query: any,
    body: any,
    headers: any,
  ): Promise<IProxyResponse> {
    console.log('------------- PROXY SERVICE --------------');
    console.log('Forwarding request to:', serviceName, method, path);
    console.log('Query:', query);
    console.log('Body:', body);
    const serviceUrl = this.configService.get<string>(
      `services.${serviceName}`,
    );

    if (!serviceUrl) {
      throw new HttpException('Cannot process request', 502);
    }

    const shouldCache = this.shouldCacheResponse(serviceName, method, path);
    if (shouldCache) {
      const cacheKey = this.getCacheKey(serviceName, path);
      const cachedResponse = await this.cacheManager.get(cacheKey);
      if (cachedResponse) {
        console.log('Returning cached data for:', cacheKey);
        return cachedResponse as IProxyResponse;
      }
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

      const cleanHeaders = Object.fromEntries(Object.entries(response.headers));
      delete cleanHeaders['transfer-encoding'];

      const responseData = {
        status: response.status,
        data: response.data,
        headers: cleanHeaders,
      };

      if (shouldCache && response.status === 200) {
        const cacheKey = this.getCacheKey(serviceName, path);
        await this.cacheManager.set(cacheKey, responseData);
        console.log('Cached data for:', cacheKey);
      }

      return responseData;
    } catch (error) {
      console.error(JSON.stringify(error));
      if (error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }
      throw new HttpException('Service unavailable', 503);
    }
  }
}
