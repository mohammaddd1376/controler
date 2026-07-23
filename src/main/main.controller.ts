import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { MainService } from './main.service';

@Controller('vpn')
export class MainController {
  constructor(private readonly mainService: MainService) {}

  // فعال کردن کاربر
  @Get('activate')
  async activate(@Query('publicKey') publicKey: string): Promise<string> {
    this.assertPublicKey(publicKey);
    return this.mainService.activateUser(publicKey);
  }

  // غیرفعال کردن کاربر
  @Get('deactivate')
  async deactivate(@Query('publicKey') publicKey: string): Promise<string> {
    this.assertPublicKey(publicKey);
    return this.mainService.deactivateUser(publicKey);
  }

  // ساخت کانفیگ جدید برای کاربر (اگر از قبل وجود داشته باشد، همان کانفیگ برگردانده می‌شود)
  @Get('create')
  async create(@Query('publicKey') publicKey: string): Promise<string> {
    this.assertPublicKey(publicKey);
    return this.mainService.createVpn(publicKey);
  }

  // حذف کانفیگ یک کاربر
  @Get('remove')
  async remove(@Query('publicKey') publicKey: string): Promise<string> {
    this.assertPublicKey(publicKey);
    return this.mainService.removeVpn(publicKey);
  }

  // لیست تمام کاربران (فقط نام کاربری‌ها، بدون متن خام منو/بنر ترمینال)
  @Get('list')
  async list(): Promise<{ index: number; username: string }[]> {
    return this.mainService.listUsers();
  }

  // بررسی وجود کانفیگ برای یک کاربر
  @Get('check')
  async check(@Query('publicKey') publicKey: string): Promise<{ exists: boolean }> {
    this.assertPublicKey(publicKey);
    const exists = await this.mainService.checkClientExists(publicKey);
    return { exists };
  }

  private assertPublicKey(publicKey: string): void {
    if (!publicKey) {
      throw new BadRequestException('پارامتر publicKey الزامی است');
    }
  }
}
