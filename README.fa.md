<div dir="rtl">

# سکوی پایش VoIP

این پروژهٔ عمومی با مجوز Apache-2.0 برای پایش سامانه‌های VoIP/PBX روی سروری جداگانه طراحی شده است. پشتیبانی از Asterisk و سامانه‌های مبتنی بر FreePBX برنامه‌ریزی شده و سازگاری با Asterisk 13.x هنوز باید آزمایش شود. اتصال به PBX هنوز پیاده‌سازی نشده است.

[English](README.md) · [راهنمای توسعه](docs/INSTALL.fa.md) · [معماری](docs/ARCHITECTURE.md) · [برنامهٔ پروژه](docs/MASTER_PLAN.md)

چارچوب کنونی شامل SQLite، ذخیره‌سازی امن اسرار، راه‌اندازی مدیر نخست، ورود محلی و نشست‌های سمت سرور است. رابط دوزبانه امکان ساخت مدیر، ورود و مدیریت پروفایل‌های Asterisk / FreePBX با گذرواژهٔ AMI رمزگذاری‌شده و فقط قابل‌نوشتن را فراهم می‌کند. پروفایل‌ها پیکربندی‌شده ولی تأییدنشده‌اند؛ اتصال شبکه‌ای به PBX و پایش هنوز وجود ندارد. این نسخه برای استقرار تولیدی آماده نیست. جزئیات در [پیکربندی](docs/CONFIGURATION.fa.md) و [عملیات](docs/OPERATIONS.fa.md) آمده است.

برای توسعه، Node.js 24.21.0 و npm لازم است. فرمان‌های بررسی:

</div>

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run test
npm run build
```

<div dir="rtl">

فرمان اجرای رابط توسعه `npm run dev -w frontend` است. برای سرور، ابتدا `npm run build -w backend` و سپس `npm run start -w backend` را اجرا کنید. جزئیات در [راهنمای ابزار توسعه](docs/TOOLCHAIN.md) آمده است.

</div>
