import { All, Controller, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller(':service')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('*path')
  async handleProxy(
    @Param('service') service: string,
    @Param('path') path: string[],
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { method, query, body, headers } = req;
    const servicePath = `/${path.join('/')}`;

    try {
      const response = await this.proxyService.forwardRequest(
        service,
        method,
        servicePath,
        query,
        body,
        headers,
      );

      res.status(response.status).set(response.headers).send(response.data);
    } catch (error) {
      res
        .status(error?.status ?? 502)
        .send(error.message || 'Cannot process request');
    }
  }
}
