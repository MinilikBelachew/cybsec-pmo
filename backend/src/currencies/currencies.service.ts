import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CurrencyDto {
  code: string;
  name: string;
  symbol: string;
}

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CurrencyDto[]> {
    const items = await this.prisma.currency.findMany({
      orderBy: { code: 'asc' },
    });
    return items.map((item) => ({
      code: item.code,
      name: item.name,
      symbol: item.symbol || item.code,
    }));
  }
}
