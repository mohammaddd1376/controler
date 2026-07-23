import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as shell from 'shelljs';
import * as fs from 'fs';
import sleep = require('sleep-promise');

const wg0ConfigPath = '/etc/wireguard/wg0.conf'; // مسیر فایل کانفیگ WireGuard
const installScriptPath = '/home/jwpn/wireguard-install.sh'; // مسیر اسکریپت نصب/مدیریت وایرگارد روی سرور

@Injectable()
export class MainService {
  private readonly logger = new Logger(MainService.name);
  private privateIP: number;

  // فعال کردن کاربر (uncomment کردن بلاک کاربر در wg0.conf)
  async activateUser(publicKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.promises
        .readFile(wg0ConfigPath, 'utf-8')
        .then((config) => {
          const updatedConfig = config.replace(
            new RegExp(
              `# ### Client ${publicKey}[\\s\\S]*?# AllowedIPs = [\\d\\.]+/32`,
              'g',
            ),
            (match) =>
              match
                .split('\n')
                .map((line) => line.replace(/^# /, ''))
                .join('\n'),
          );

          return fs.promises.writeFile(wg0ConfigPath, updatedConfig, 'utf-8');
        })
        .then(() => {
          shell.exec(
            'sudo systemctl restart wg-quick@wg0',
            { async: true },
            (code) => {
              if (code !== 0) {
                reject(new InternalServerErrorException('Error restarting WireGuard'));
              } else {
                resolve('User activated successfully');
              }
            },
          );
        })
        .catch((err) =>
          reject(new InternalServerErrorException(`Error handling config file: ${err.message}`)),
        );
    });
  }

  // غیرفعال کردن کاربر (comment کردن بلاک کاربر در wg0.conf)
  async deactivateUser(publicKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.promises
        .readFile(wg0ConfigPath, 'utf-8')
        .then((config) => {
          const updatedConfig = config.replace(
            new RegExp(`### Client ${publicKey}[\\s\\S]*?AllowedIPs = [\\d\\.]+/32`, 'g'),
            (match) =>
              match
                .split('\n')
                .map((line) => `# ${line}`)
                .join('\n'),
          );

          return fs.promises.writeFile(wg0ConfigPath, updatedConfig, 'utf-8');
        })
        .then(() => {
          shell.exec(
            'sudo systemctl restart wg-quick@wg0',
            { async: true },
            (code) => {
              if (code !== 0) {
                reject(new InternalServerErrorException('Error restarting WireGuard'));
              } else {
                resolve('User deactivated successfully');
              }
            },
          );
        })
        .catch((err) =>
          reject(new InternalServerErrorException(`Error handling config file: ${err.message}`)),
        );
    });
  }

  // پیدا کردن اولین آی‌پی خصوصی آزاد در بازه‌ی 10.66.66.3 تا 10.66.66.249
  private async findFreeIp(): Promise<number> {
    const data = await fs.promises.readFile(wg0ConfigPath, 'utf8');
    const allowedIPs: string[] = [];
    const lines = data.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('AllowedIPs')) {
        const ips = line.substring(line.indexOf('=') + 1).trim().split(',');
        for (const ipRaw of ips) {
          const ip = ipRaw.trim();
          if (!allowedIPs.includes(ip)) {
            allowedIPs.push(ip);
          }
        }
      }
    }

    for (let i = 3; i < 250; i++) {
      const ipToCheck = `10.66.66.${i}/32`;
      if (!allowedIPs.includes(ipToCheck)) {
        this.logger.log(`${ipToCheck} آزاد است`);
        return i;
      }
    }

    throw new InternalServerErrorException('هیچ آی‌پی آزادی در بازه پیدا نشد');
  }

  // بررسی اینکه آیا کانفیگ برای این کاربر از قبل ساخته شده یا نه
  async checkClientExists(publicKey: string): Promise<boolean> {
    return fs.existsSync(`/root/wg0-client-${publicKey}.conf`);
  }

  // ساخت کانفیگ جدید برای کاربر (یا برگرداندن کانفیگ موجود در صورت وجود)
  async createVpn(publicKey: string): Promise<string> {
    const configPath = `/root/wg0-client-${publicKey}.conf`;
    const fileExists = fs.existsSync(configPath);

    if (!fileExists) {
      this.privateIP = await this.findFreeIp();

      const result = shell.exec(installScriptPath, { async: true }) as any;
      result.stdin.write('1\n'); // انتخاب گزینه‌ی «افزودن کاربر جدید»
      result.stdin.write(publicKey + '\n'); // نام کاربر
      result.stdin.write(this.privateIP + '\n');
      result.stdin.write(this.privateIP + '\n');
      result.stdin.end();

      await sleep(2500);
    } else {
      await sleep(500);
    }

    if (!fs.existsSync(configPath)) {
      throw new InternalServerErrorException('ساخت کانفیگ ناموفق بود، فایل ایجاد نشد');
    }

    return fs.promises.readFile(configPath, 'utf-8');
  }

  // حذف کانفیگ یک کاربر
  async removeVpn(publicKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const result = shell.exec(installScriptPath, { async: true }) as any;
      result.stdin.write('3\n'); // انتخاب گزینه‌ی «حذف کاربر»

      let matched = false;

      result.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        const regex = new RegExp(`(\\d+)\\)\\s*${publicKey}`);
        const matches = regex.exec(text);

        if (matches && matches[1]) {
          matched = true;
          const numberBeforeName = parseInt(matches[1], 10);
          result.stdin.write(numberBeforeName + '\n');
          result.stdin.write('y\n'); // تایید حذف در صورت نیاز اسکریپت
        }
      });

      result.on('exit', (code: number) => {
        if (!matched) {
          reject(new InternalServerErrorException('کاربر مورد نظر پیدا نشد'));
          return;
        }
        if (code === 0) {
          resolve('کاربر با موفقیت حذف شد');
        } else {
          reject(new InternalServerErrorException('حذف کاربر ناموفق بود'));
        }
      });

      result.stdin.end();
    });
  }

  // لیست کاربران وایرگارد (بر اساس خروجی اسکریپت نصب)
  async listUsers(): Promise<string> {
    return new Promise((resolve) => {
      const result = shell.exec(installScriptPath, { async: true }) as any;
      let output = '';

      result.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      result.stdin.write('2\n'); // انتخاب گزینه‌ی «نمایش لیست کاربران»
      result.stdin.end();

      setTimeout(() => {
        resolve(output);
      }, 2000);
    });
  }
}
