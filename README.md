<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## مستندات فارسی (WireGuard Controller)

این پروژه، سرویس مدیریت کلاینت‌های WireGuard است که با فریم‌ورک **NestJS** نوشته شده. منطق ساخت/حذف/لیست کاربران از پروژه‌ی `jwpn` استخراج و در قالب ماژول `main` بازنویسی شده و کنار قابلیت فعال/غیرفعال‌سازی که از قبل وجود داشت قرار گرفته است.

### پیش‌نیازها روی سرور
- اسکریپت `wireguard-install.sh` (کنار پروژه قرار دارد) باید در سرور در مسیر `/home/jwpn/wireguard-install.sh` باشد (یا مسیر آن را در `src/main/main.service.ts` در متغیر `installScriptPath` تغییر دهید).
- فایل `/etc/wireguard/wg0.conf` باید توسط همان اسکریپت ساخته شده باشد.
- برنامه باید با دسترسی `root` یا کاربری با مجوز اجرای `systemctl restart wg-quick@wg0` اجرا شود.

### روت‌های موجود (پیشوند `/vpn`)

| متد | مسیر | پارامتر | توضیح |
|---|---|---|---|
| GET | `/vpn/create` | `publicKey` | ساخت کانفیگ جدید برای کاربر (اگر از قبل وجود داشته باشد همان را برمی‌گرداند) |
| GET | `/vpn/remove` | `publicKey` | حذف کانفیگ کاربر |
| GET | `/vpn/list` | - | لیست کاربران |
| GET | `/vpn/check` | `publicKey` | بررسی وجود کانفیگ برای کاربر (`{ exists: boolean }`) |
| GET | `/vpn/activate` | `publicKey` | فعال کردن (uncomment) بلاک کاربر در `wg0.conf` |
| GET | `/vpn/deactivate` | `publicKey` | غیرفعال کردن (comment) بلاک کاربر در `wg0.conf` |

### اجرا روی سرور

```bash
npm i
npm run build
chmod +x wireguard-install.sh
mkdir -p /home/jwpn && cp wireguard-install.sh /home/jwpn/wireguard-install.sh
npm run start:prod
```

### اجرای همیشه پایدار (طوری که در هیچ حالتی متوقف نشود)

این پروژه در سه لایه در برابر توقف محافظت شده:

1. **داخل خود کد (`src/main.ts`)**: خطاهای `uncaughtException` و `unhandledRejection` گرفته و فقط لاگ می‌شوند، به‌جای اینکه کل پروسه‌ی Node کرش کند. اگر بالا آمدن اولیه‌ی سرور هم شکست بخورد (مثلا پورت موقتاً اشغال باشد)، خودش هر ۳ ثانیه دوباره تلاش می‌کند.
2. **pm2** (توصیه‌شده): با `ecosystem.config.js` که در ریشه‌ی پروژه اضافه شده، هر بار که پروسه کرش کند یا حافظه بیش از حد مصرف کند، به‌صورت خودکار ری‌استارت می‌شود؛ حتی هر روز ساعت ۴ صبح برای جلوگیری از نشتی حافظه‌ی بلندمدت یک ری‌استارت پیشگیرانه انجام می‌دهد.
3. **systemd** (لایه‌ی بیرونی‌ترین): چه از pm2 استفاده کنید چه مستقیم از node، systemd هم پروسه را زیر نظر دارد تا حتی اگر خودِ pm2 یا سرور ری‌استارت شود، سرویس بعد از boot دوباره بالا بیاید.

#### روش ۱: با pm2 (پیشنهادی)

```bash
npm i
npm run build
mkdir -p /var/log/wg-controller
chmod +x wireguard-install.sh
mkdir -p /home/jwpn && cp wireguard-install.sh /home/jwpn/wireguard-install.sh

npm i -g pm2
pm2 start ecosystem.config.js
pm2 save                # وضعیت فعلی pm2 را ذخیره کن
pm2 startup systemd      # دستوری که چاپ می‌شود را اجرا کن تا pm2 خودش بعد از ریبوت سرور هم بالا بیاید
```

دستورات مفید:
```bash
pm2 status               # وضعیت سرویس
pm2 logs wg-controller   # لاگ زنده
pm2 restart wg-controller
```

#### روش ۲: مستقیم با systemd (بدون pm2)

فایل نمونه در `deploy/wg-controller.service` قرار دارد:

```bash
npm i
npm run build
chmod +x wireguard-install.sh
mkdir -p /home/jwpn && cp wireguard-install.sh /home/jwpn/wireguard-install.sh

cp deploy/wg-controller.service /etc/systemd/system/wg-controller.service
# اگر پروژه در مسیر دیگری غیر از /home/controler است، WorkingDirectory را در فایل سرویس اصلاح کنید
systemctl daemon-reload
systemctl enable --now wg-controller.service
```

با `Restart=always` و `StartLimitIntervalSec=0`، systemd صرف‌نظر از تعداد دفعات و دلیل خروج پروسه (کرش، OOM، خطای غیرمنتظره)، همیشه دوباره آن را اجرا می‌کند.

دستورات مفید:
```bash
systemctl status wg-controller
journalctl -u wg-controller -f   # لاگ زنده
systemctl restart wg-controller
```

> **نکته:** استفاده‌ی هم‌زمان از هر دو روش لازم نیست؛ یکی از این دو را انتخاب کنید. اگر با pm2 اجرا می‌کنید و می‌خواهید pm2 هم بعد از ریبوت سرور بالا بیاید، حتماً مرحله‌ی `pm2 startup` و `pm2 save` را انجام دهید؛ در غیر این صورت بعد از ریبوت سرور، سرویس بالا نخواهد آمد.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
