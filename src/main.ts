import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

// خطاهایی که به‌صورت عادی باعث کرش کامل پروسه‌ی Node می‌شوند را
// اینجا می‌گیریم و فقط لاگ می‌کنیم تا سرویس بالا بماند.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.stack || err.message);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason as any);
});

async function bootstrap(retryDelayMs = 3000): Promise<void> {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // خاموش شدن تمیز روی SIGTERM/SIGINT (مثلا هنگام ری‌استارت pm2/systemd)
    app.enableShutdownHooks();

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    logger.log(`سرور روی پورت ${port} بالا آمد`);
  } catch (err) {
    // اگر خود بالا آمدن سرور (مثلا پورت اشغال بودن به‌صورت موقت) شکست بخورد،
    // به‌جای متوقف شدن کامل پروسه، دوباره تلاش می‌کنیم.
    logger.error('خطا در بالا آمدن سرور، تلاش مجدد در چند ثانیه...', err as any);
    setTimeout(() => bootstrap(retryDelayMs), retryDelayMs);
  }
}

bootstrap();
