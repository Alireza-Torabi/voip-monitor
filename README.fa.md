<div dir="rtl">

# سکوی پایش VoIP

این پروژهٔ عمومی با مجوز Apache-2.0 برای پایش سامانه‌های VoIP/PBX روی سروری جداگانه طراحی شده است. پشتیبانی نخستین برای Asterisk و سامانه‌های مبتنی بر FreePBX است. یک Compatibility Baseline کنترل‌شده روی Asterisk 13.x واقعی با موفقیت عبور کرده است؛ پوشش Versionها و Featureهای بیشتر هنوز باید جداگانه اعتبارسنجی شود. انتقال AMI و چرخهٔ اجرای ارائه‌دهنده وجود دارند، اما شبکهٔ PBX به‌طور پیش‌فرض غیرفعال است.

[English](README.md) · [راهنمای توسعه](docs/INSTALL.fa.md) · [معماری](docs/ARCHITECTURE.md) · [برنامهٔ پروژه](docs/MASTER_PLAN.md)

چارچوب کنونی شامل SQLite، ذخیره‌سازی امن اسرار، راه‌اندازی مدیر نخست، ورود محلی، نشست‌های سمت سرور، چرخهٔ اجرای ارائه‌دهندهٔ Asterisk، آزمایش احرازشدهٔ اتصال، رویدادهای نرمال‌شدهٔ AMI، Snapshot/Reconciliation معتبر کانال‌ها و یک State Engine داخلی و قطعی برای Channel/Call است. رابط دوزبانه پروفایل‌های Asterisk / FreePBX را با گذرواژهٔ AMI رمزگذاری‌شده و فقط قابل‌نوشتن مدیریت و وضعیت امن اتصال را نمایش می‌دهد. دسترسی شبکه به PBX به‌طور پیش‌فرض غیرفعال است؛ Telephony State هنوز از طریق REST/WebSocket منتشر نمی‌شود و داشبورد بلادرنگ پیاده‌سازی نشده است. این نسخه برای استقرار تولیدی آماده نیست. جزئیات در [پیکربندی](docs/CONFIGURATION.fa.md) و [عملیات](docs/OPERATIONS.fa.md) آمده است.

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
