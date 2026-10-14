import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('constructs with the SQLite adapter', async () => {
    const service = new PrismaService();

    await expect(service.$queryRaw`SELECT 1`).resolves.toBeDefined();
    await service.$disconnect();
  });
});
