<div dir="rtl" align="right">

# مستر پلن پروژه VoIP Monitor

**وضعیت:** 2026-09-26
**منبع اصلی حقیقت:** `docs/MASTER_PLAN.md`
**قاعده:** این فایل پس از هر Task همراه نسخه انگلیسی به‌روزرسانی می‌شود. جزئیات کامل Failure Log و Decisionهای شماره‌دار در نسخه انگلیسی و `docs/DECISIONS.md` نگهداری می‌شوند.

## هدف پروژه

ساخت سامانه‌ای مستقل و Read-Only برای پایش چند PBX، به‌طوری‌که خرابی سامانه مانیتورینگ هیچ اثری روی مسیر تماس نداشته باشد. Credential، Topology، Log خام و اطلاعات واقعی سازمان فقط در `.local/` یا Runtime Storage می‌مانند و وارد Git عمومی نمی‌شوند.

## وضعیت Roadmap

- [x] Task 1 تا 6: Backend/Frontend پایه، Configuration، SQLite، Secret Store، Authentication و PBX CRUD.
- [x] Task 7 تا 12: Asterisk/AMI، Runtime، Event، Snapshot/Reconciliation و Verification کنترل‌شده Asterisk 13.x.
- [x] Task 13 تا 17: Telephony State Engine، Endpoint، Trunk، Queue و Agent Interaction.
- [x] Task 18 تا 24: System Metrics، Restricted SSH، Trust/Pinning، Runtime، Persistence و HTTP/SSE.
- [x] Task 25 تا 27: Security Event از AMI، Persistence و HTTP/SSE.
- [x] Task 28: ارزیابی محدود و Fail-Closed قوانین Security Alert بدون External Delivery.
- [x] Task 29: Persistence محدود Security Alert شامل History بدون Duplicate، Current State جدا برای هر Rule، Ordering بر اساس Stream در صورت وجود، Retention تراکنشی و Cascade با حذف PBX.
- [x] Task 30: API احرازشده Current/History برای Security Alert و SSE محدود و PBX-scoped که فقط Alertهای جدید و واقعاً Persist‌شده را منتشر می‌کند؛ بدون External Notification Delivery.

## وضعیت فعلی Git و Handoff

- Task 29 از طریق PR #31 داخل `main` Merge شده است.
- Branch فعلی: `feature/security-alert-api-realtime`
- Task 30 به‌صورت Local پیاده‌سازی شده و هنوز Commit/Push/Merge نشده است.
- هیچ PBX واقعی، Production Security Log، Webhook یا سرویس Notification در Task 30 استفاده نشده است.
- Task بعدی پس از Merge شدن Task 30: **Task 31 — تعریف Persistent و Bounded برای Security Alert Rule Configuration و اتصال Runtime Evaluation به Persistence، بدون External Notification Delivery.**

## Task 30 چه چیزی اضافه کرد؟

- `GET /api/pbx-instances/:id/security-alerts` برای Current Alertهای Persist‌شده به‌صورت مجموعه per-rule.
- `GET /api/pbx-instances/:id/security-alerts/history` با بازه UTC اجباری و سقف 500 ردیف.
- `GET /api/pbx-instances/:id/security-alerts/stream` با SSE احرازشده، Same-Origin، PBX Scope، Heartbeat و سقف 64 Stream همزمان.
- Initial SSE Snapshot از Current State Persist‌شده ارسال می‌شود.
- Realtime فقط بعد از Transaction موفق و فقط برای Alert جدیدی که History واقعاً Insert کرده باشد منتشر می‌شود؛ Duplicate Save دوباره Publish نمی‌شود.
- Exception یک Listener بعد از Persistence، Storage را Rollback یا خراب نمی‌کند.

## Failure و محدودیت Task 30

- در Patch اولیه Heartbeat SSE، Escape مربوط به newline اشتباه تولید شد و TypeScript string شکسته شد. Root Cause، escape handling در Local patch generator بود. قبل از Typecheck کامل اصلاح شد.
- در Draft اولیه، هر `save()` می‌توانست Realtime publish کند حتی اگر History به‌دلیل Dedup تغییری نکرده باشد. این رفتار اصلاح شد و Publish فقط بعد از Insert واقعی و Commit موفق انجام می‌شود.
- Task 30 هنوز Alert را خودکار تولید نمی‌کند؛ Persistent Rule Configuration و Runtime Ownership برای اجرای Evaluator هنوز وجود ندارد.
- External Notification Delivery و Dashboard Alert Presentation هنوز پیاده نشده‌اند.
- Telephony State هنوز Browser-facing API/Realtime ندارد.

## قاعده پایان هر Task

1. `docs/MASTER_PLAN.md` و این فایل را همگام کن.
2. Task Status، Failure/Bug، Root Cause، Fix، Known Limitations و Exact Next Task را ثبت کن.
3. در صورت نیاز `PROJECT_CONTEXT.md`، `DECISIONS.md`، `ARCHITECTURE.md` و Runbookها را اصلاح کن.
4. `.local/SESSION_HANDOFF.md` را با Git State واقعی و Prompt ادامه‌کار به‌روز کن.
5. Lint، Format Check، Typecheck، Tests، Build، Foundation، License و Secret/Public review را اجرا کن.
6. Commit و Push کن و تا تأیید Merge Task جدید شروع نکن.

</div>
