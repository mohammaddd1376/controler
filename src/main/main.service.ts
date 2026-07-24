import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as shell from 'shelljs';
import * as fs from 'fs';
import sleep = require('sleep-promise');

const wg0ConfigPath = '/etc/wireguard/wg0.conf'; // مسیر فایل کانفیگ WireGuard
const wgParamsPath = '/etc/wireguard/params'; // فایل تنظیمات اسکریپت wireguard-install (شامل SERVER_WG_IPV4 واقعی)
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

  // خواندن SERVER_WG_IPV4 از /etc/wireguard/params و استخراج سه اکتت اول (BASE_IP)
  // دقیقا مطابق منطق خود اسکریپت wireguard-install.sh:
  //   BASE_IP=$(echo "$SERVER_WG_IPV4" | awk -F '.' '{ print $1"."$2"."$3 }')
  private async getSubnetPrefix(): Promise<{ prefix: string; serverIp: string }> {
    const content = await fs.promises.readFile(wgParamsPath, 'utf-8');
    const match = /^SERVER_WG_IPV4\s*=\s*([\d.]+)\s*$/m.exec(content);

    if (!match) {
      throw new InternalServerErrorException(
        `SERVER_WG_IPV4 در فایل ${wgParamsPath} پیدا نشد`,
      );
    }

    const serverIp = match[1];
    const octets = serverIp.split('.');
    if (octets.length !== 4) {
      throw new InternalServerErrorException(`فرمت SERVER_WG_IPV4 نامعتبر است: ${serverIp}`);
    }

    return { prefix: `${octets[0]}.${octets[1]}.${octets[2]}.`, serverIp };
  }

  // پیدا کردن اولین آی‌پی خصوصی آزاد در سابنت واقعی سرور (خوانده‌شده از /etc/wireguard/params)
  private async findFreeIp(): Promise<number> {
    const { prefix, serverIp } = await this.getSubnetPrefix();

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

    for (let i = 2; i < 255; i++) {
      const candidateIp = `${prefix}${i}`;
      if (candidateIp === serverIp) {
        continue; // آی‌پی خود سرور (معمولا x.x.x.1) رد شود
      }
      const ipToCheck = `${candidateIp}/32`;
      if (!allowedIPs.includes(ipToCheck)) {
        this.logger.log(`${ipToCheck} آزاد است`);
        return i; // فقط آخرین اکتت را برمی‌گردانیم؛ چون اسکریپت هم فقط همین را از ورودی می‌خواهد
      }
    }

    throw new InternalServerErrorException('هیچ آی‌پی آزادی در این سابنت پیدا نشد');
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

    const rawConfig = await fs.promises.readFile(configPath, 'utf-8');
    const formattedConfig = this.formatClientConfig(rawConfig);

    // فایل روی دیسک هم با همین قالب بازنویسی می‌شود تا دفعات بعدی
    // (وقتی کانفیگ از قبل وجود دارد) هم همین فرمت برگردانده شود
    await fs.promises.writeFile(configPath, formattedConfig, 'utf-8');

    return formattedConfig;
  }

  // کانفیگ خام تولیدشده توسط wireguard-install.sh را می‌گیرد و به قالب دلخواه تبدیل می‌کند:
  // بدون PresharedKey، بدون IPv6 در AllowedIPs، یک DNS، به‌همراه MTU و PersistentKeepalive.
  // فقط PrivateKey / Address / PublicKey سرور / Endpoint واقعی از فایل خام استخراج و در قالب جدید قرار می‌گیرند.
  private formatClientConfig(rawConfig: string): string {
    const privateKeyMatch = /PrivateKey\s*=\s*(\S+)/.exec(rawConfig);
    const addressMatch = /^Address\s*=\s*(\S+)/m.exec(rawConfig);
    const peerSectionMatch = /\[Peer\]([\s\S]*)/.exec(rawConfig);
    const peerSection = peerSectionMatch ? peerSectionMatch[1] : '';
    const serverPublicKeyMatch = /PublicKey\s*=\s*(\S+)/.exec(peerSection);
    const endpointMatch = /Endpoint\s*=\s*(\S+)/.exec(peerSection || rawConfig);

    if (!privateKeyMatch || !addressMatch || !serverPublicKeyMatch || !endpointMatch) {
      throw new InternalServerErrorException(
        'فرمت کانفیگ خروجی wireguard-install.sh غیرمنتظره بود و قابل تبدیل به قالب دلخواه نیست',
      );
    }

    const privateKey = privateKeyMatch[1];
    const address = addressMatch[1];
    const serverPublicKey = serverPublicKeyMatch[1];
    const endpoint = endpointMatch[1];

    return [
      '[Interface]',
      `PrivateKey = ${privateKey}`,
      `Address = ${address}`,
      'DNS = 1.1.1.1',
      'MTU = 1280',
      '',
      '[Peer]',
      `PublicKey = ${serverPublicKey}`,
      'AllowedIPs = 0.0.0.0/0',
      `Endpoint = ${endpoint}`,
      'PersistentKeepalive = 21',
      '',
    ].join('\n');
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

  // لیست کاربران وایرگارد (بر اساس خروجی اسکریپت نصب) - فقط لیست تمیز کاربران، بدون بنر/منوی خام ترمینال
  async listUsers(): Promise<{ index: number; username: string }[]> {
    return new Promise((resolve) => {
      const result = shell.exec(installScriptPath, { async: true }) as any;
      let output = '';

      result.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      result.stdin.write('2\n'); // انتخاب گزینه‌ی «نمایش لیست کاربران»
      result.stdin.end();

      setTimeout(() => {
        resolve(this.parseUserList(output));
      }, 2000);
    });
  }

  // از کل خروجی خام ترمینال اسکریپت (که شامل بنر خوش‌آمدگویی و متن منو هم هست)
  // فقط خطوطی که دقیقا به شکل «عدد) نام‌کاربری» هستند را استخراج می‌کند.
  // خطوط منو مثل «1) Add a new user» چون چند کلمه‌ای هستند با این الگو مچ نمی‌شوند
  // و به همین ترتیب از لیست جدا می‌مانند.
  private parseUserList(rawOutput: string): { index: number; username: string }[] {
    // بعد از آخرین «5) Exit» (پایان بنر منوی اصلی) شروع به پارس کن،
    // تا خود گزینه‌ی منو با username تک‌کلمه‌ای «Exit» اشتباه گرفته نشود
    const menuEndMarker = /\d+\)\s*Exit\s*$/im;
    const markerMatch = menuEndMarker.exec(rawOutput);
    const listSection = markerMatch
      ? rawOutput.slice(markerMatch.index + markerMatch[0].length)
      : rawOutput;

    const lines = listSection.split('\n');
    const users: { index: number; username: string }[] = [];
    const lineRegex = /^(\d+)\)\s+(\S+)\s*$/;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const match = lineRegex.exec(line);
      if (match) {
        users.push({
          index: parseInt(match[1], 10),
          username: match[2],
        });
      }
    }

    return users;
  }
}
