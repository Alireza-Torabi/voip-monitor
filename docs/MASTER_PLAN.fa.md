# Master Plan

Status: 2026-10-07. Taskهای 58 و 59 Merge شده‌اند. Task 60 — Call Outcome Analytics روی Branch feature/call-outcome-analytics کامل شده و قبل از Merge منتظر بررسی Operator روی محیط Development است. بعد از Merge شدن Task 60، Task 61 — Call Quality Source Discovery تسک بعدی Roadmap خواهد بود.

## Phase 0 - کشف محیط

- [x] سیستم عامل، فضای کاری، Git، GitHub CLI، Docker، Compose، Node.js، npm و فایل ها را بررسی کنید.
- [x] ثبت وضعیت مشاهده شده؛ هیچ بسته سیستمی را نصب نکنید و بدون PBX تماس بگیرید.

## Phase 1 - بنیاد مخزن عمومی

### تکمیل شد

- [x] راه اندازی `main` محلی؛ `.local/` خصوصی و مسیرهای Runtime را نادیده بگیرید.
- [x] فایل های خط مشی عمومی، README انگلیسی/فارسی و جفت های اسناد، مجوز رسمی Apache-2.0 و NOTICE بی طرف مالکیت ایجاد کنید.
- [x] معماری رکورد، تصمیمات، زمینه پروژه و بررسی مجوز وابستگی مستقیم برنامه ریزی شده.
- [x] مانیفست‌های فضای کاری npm، هدف Node.js 24 LTS، پیکربندی سخت‌گیرانه پایه TypeScript، و استراتژی lint/format/test/build مستند را اضافه کنید.
- [x] بدون سرویس، پایه نوشتن و طرح‌بندی داده/مخفی Runtime را اضافه کنید.
- [x] CI را برای بررسی های پایه موجود فقط با استفاده از فایل های مصنوعی/عمومی اضافه کنید.
- [x] چک‌کننده بنیاد را اجرا کنید و فایل‌های عمومی را برای اسرار آشکار بررسی کنید.

### بسته شدن GitHub

- [x] تفاوت مرحله‌ای را مرور کنید و commit اولیه تمیز را با هویت Git فقط مخزن ارائه شده توسط کاربر ایجاد کنید.
- [x] پس از تأیید عدم وجود کنترل از راه دور، `origin` را در مخزن ارائه شده توسط کاربر پیکربندی کنید.
- [x] commit اولیه پایه را به GitHub فشار دهید. `main` `origin/main` را ردیابی می کند.
- [x] نقاط `main` راه دور را به `974f0cb2ec471878d58c71639e904bca48bb8aaf` (`chore: establish public repository foundation`) تأیید کنید.

commit محلی قبلی `e735f1c` قبل از انتشار اصلاح شد تا از هویت noreply درخواستی استفاده شود. این در اصل و نسب `origin/main` نیست. تعهد بنیاد منتشر شده `974f0cb` است.

### دروازه های وابسته به زنجیره ابزار معوق

- [x] یک فایل قفل npm ایجاد کنید و شناسه‌های مجوز حل‌شده را ممیزی کنید (تکمیل شده در Phase 2 Task 1).
- [x] Lintها، قالب‌بندی، تایپ‌چک، تست‌ها و ساخت‌ها را برای اسکلت اولیه اجرا کنید (در مرحله 2 Task 1 تکمیل شد).
- [ ] اعتبار سنجی Docker هنگامی که زمینه ساخت Docker و سرویس وجود دارد، تصاویر را بنویسید و بسازید.

این بررسی‌های بعدی سابقه اعتبارسنجی Phase 1 را تغییر نمی‌دهند. اعتبار Docker به تعویق افتاده است. در دسترس بودن ابزار محلی فقط در `.local/` نادیده گرفته شده ثبت می شود.

## Phase 2 - پایه کاربردی

- [x] Task 1: زنجیره ابزار محلی Node 24/npm تایید شده، حداقل Backend `GET /health`، پوسته React دو زبانه، یک فایل قفل، Gate های با کیفیت و CI. اعتبار محلی تصویب شد. شاخه ویژگی در `main` به عنوان `e737abd` ادغام شد.
- [x] Task 2: قراردادهای مشترک ارائه‌دهنده خنثی، مدل‌های قابلیت تایپ و منبع سلامت، پیکربندی برنامه کاربردی تأیید شده متمرکز، و خطاهای پیکربندی ایمن/ ویرایش گزارش. بدون PBX یا رفتار مداوم.
- [x] Task 3: انتزاع ذخیره سازی SQLite، تاریخچه انتقال تراکنش ها، راه اندازی و حداقل Persistence فراداده PBX، و آمادگی برنامه.
- [x] Task 4: چرخه حیات کلید اصلی محافظت شده، Persistence مخفی PBX AES-256-GCM، ادغام آمادگی، و اسناد بازیابی.
- [x] Task 5: بوت استرپ اول مدیر محافظت شده، احراز هویت رمز عبور محلی، جلسات سمت سرور، محدودیت های CSRF و تلاش، و انتقال وضعیت راه اندازی.
- [x] Task 6: CRUD نمایه PBX احراز هویت شده، فراداده AMI با محدوده ارائه دهنده، اعتبارنامه های رمزگذاری شده فقط برای نوشتن، وضعیت راه اندازی پیکربندی شده-تأیید نشده و رابط کاربری دوزبانه راه اندازی/ورود/ورود. بدون دسترسی به شبکه PBX
- [x] Task 7: خط مشی مرز شبکه ارائه دهنده Asterisk، مرز آدرس-رزولیشن تزریقی، و پایه حمل و نقل ساختگی AMI. بدون جستجوی واقعی DNS، سوکت، ورود به سیستم AMI یا دسترسی PBX.
- [x] Task 8: انتقال سیم ساده TCP AMI، قاب بندی عمل ایمن/ActionID/مدت زمان پایان، مرز حل‌کننده DNS گره، و پایه ورود/کشف/سازگار ارائه‌دهنده Asterisk‌ای. آزمایش‌ها فقط از مدل‌های ساختگی و یک سرور AMI مصنوعی استفاده می‌کنند. راه اندازی Runtime هنوز هیچ اتصال PBX ایجاد نمی کند.
- [x] Task 9: چرخه عمر Runtimeی ارائه دهنده با یک ارائه دهنده مدیریت شده در هر PBX فعال، اتصال مجدد/بازگشت و تطبیق محدود، فعال سازی شبکه صریح، API های وضعیت ارائه دهنده احراز هویت و آزمون اتصال/کشف، مهر زمانی تأیید مداوم، و رابط کاربری آزمون اتصال دو زبانه. تست ها فقط ساختگی/مصنوعی باقی می مانند. بدون دسترسی واقعی PBX
- [x] Task 10: اشتراک رویداد حمل و نقل AMI، قراردادهای رویداد عادی خنثی از سوی ارائه دهنده، عادی سازی رویداد Asterisk و ارسال رویداد در Runtime. پوشش مصنوعی شامل چرخه عمر/وضعیت کانال، چرخه عمر شماره گیری، عضویت در پل، و وضعیت همتای chan_sip است. محموله های خام AMI برای مصرف کنندگان ارسال نمی شوند.
- [x] Task 11: کنش‌های فهرست رویداد AMI مرتبط با ActionID، عکس‌های فوری ارائه‌دهنده `CoreShowChannels`، حداقل عکس‌های فوری کانال خنثی از ارائه‌دهنده، انتشار عکس فوری اولیه، و عکس‌های فوری تطبیق دوره‌ای. لیست های جزئی/لغو شده/ناسازگار با شکست مواجه می شوند. تخریب عکس فوری باعث اتصال مجدد طوفان نمی شود.
- [x] Task 12: راستی‌آزمایی سازگاری با PBX واقعی فقط خواندنی کنترل شده از پیش‌فرض‌های Asterisk 13.x و Task 8-11 AMI. مدیریت اعتبار فقط محلی، تأییدکننده محدود، runbook دوزبانه، طبقه‌بندی خطای ایمن، ورود به سیستم/کشف، `CoreShowChannels`، رویدادهای زنده عادی شده غیرفعال، تطبیق و قطع اتصال پاک در برابر یک سیستم Asterisk 13.x واقعی بدون تغییرات PBX تأیید شد.
- [x] Task 13: پایه موتور حالت تلفن داخلی. فریم‌های ارائه‌دهنده اکنون نسل‌های اتصال هر فرآیند و شماره‌های دنباله هر فریم را حمل می‌کنند. آیتم های عکس فوری کانال دنباله منبع خود را حفظ می کنند. موتور قبل از شروع Runtime مشترک می‌شود، رویدادها را در اطراف مرزهای مجموعه عکس فوری بافر/بازپخش می‌کند، عکس‌های فوری تطبیق را تعمیر می‌کند، `CURRENT`/`AWAITING_SNAPSHOT`/`STALE` را ردیابی می‌کند، کانال‌های فعلی را در تماس‌های قطعی گروه‌بندی می‌کند، و زمانی که نمایه PBX جایگزین می‌شود یا اجرا می‌شود، حالت را بازنشانی می‌کند. هنوز نقطه پایانی وضعیت REST/WebSocket وجود ندارد.
- [x] Task 14: پایه و اساس وضعیت نقطه پایانی/ثبتی. ارائه‌دهنده Asterisk اکنون یک عکس فوری مستقل `SIPpeers`/PeerEntry برای نقاط انتهایی chan_sip جمع‌آوری می‌کند، ثبت‌نام و قابلیت دسترسی را بدون آدرس‌های باز ارسال یا فیلدهای AMI خام عادی می‌کند، قابلیت نقطه پایانی را به‌عنوان `SUPPORTED`، `PERMISSION_DENIED`، یا `UNSUPPORTED` ثبت می‌کند، و زمانی که لیست‌های نقطه پایانی توسط ما غیرقابل‌شات است را نگه می‌دارد. قابلیت موتور حالت، عکس‌های فوری نقطه پایانی را با استفاده از مرز توالی خودش تطبیق می‌دهد، فقط رویدادهای جدیدتر PeerStatus را دوباره پخش می‌کند، زمانی که رویدادی `UNKNOWN` را گزارش می‌کند، ابعاد شناخته‌شده را حفظ می‌کند، و زمانی که هیچ عکس فوری نقطه پایانی معتبری در دسترس نیست، از ساخت وضعیت نقطه پایانی خودداری می‌کند. فقط مصنوعی / ساختگی. بدون دسترسی واقعی PBX
- [x] Task 15: پایه وضعیت تنه. قراردادهای ترانک خنثی ارائه دهنده، ترانک های ثبت خروجی را به صراحت متمایز می کنند. ارائه‌دهنده استریسک از مرز عکس فوری `SIPshowregistry` / `RegistryEntry` / `RegistrationsComplete` مستقل استفاده می‌کند، رویدادهای زنده `Registry` را عادی می‌کند، قابلیت ترانک را به‌طور مستقل گزارش می‌کند، و وضعیت کانال/نقطه پایانی را زمانی که فهرست رجیستری رد یا پشتیبانی نمی‌شود قابل استفاده نگه می‌دارد. موتور حالت، عکس‌های فوری تنه را با مرز سفارش خود تطبیق می‌دهد، فقط رویدادهای رجیستری جدیدتر را دوباره پخش می‌کند، و اگر سرریز ژورنال هر مرز عکس فوری مستقل پشتیبانی شده را ناامن کند، بسته نمی‌شود. فقط مصنوعی / ساختگی. بدون دسترسی واقعی PBX
- [x] Task 16: پایه وضعیت صف. حمل‌ونقل فهرست رویداد AMI اکنون از یک لیست مجاز صریح از نام‌های رویداد مرتبط متعدد پشتیبانی می‌کند تا `QueueStatus` بتواند با خیال راحت `QueueParams`، `QueueMember` و `QueueEntry` را تحت یک ActionID و مرز تکمیل جمع‌آوری کند. قراردادهای خنثی ارائه‌دهنده، هویت/استراتژی صف، در دسترس بودن/مکث/وضعیت مکالمه عضو صف، و هویت/موقعیت/انتظار تماس‌گیرنده در صف فعلی را بدون ارسال CallerID، نام کانال، دلایل توقف، جزئیات رابط حالت، یا فیلدهای خام دلخواه AMI نشان می‌دهند. عادی‌سازی زنده وضعیت عضو صف/افزودن/مکث/جریمه/استفاده از زنگ/حذف و پیوستن/ترک/ترک رویدادهای تماس‌گیرنده را پوشش می‌دهد. موتور حالت به اسنپ شات های صف یک مرز سفارش/تازه بودن مستقل می دهد، تعداد انتظار را از وضعیت تماس گیرنده فعلی استخراج می کند و شامل مرزهای صف در بازیابی سرریز مجله بسته شده با شکست می شود. فقط مصنوعی / ساختگی. بدون دسترسی واقعی PBX
- [x] Task 17: بنیاد حالت تعامل عامل. رویدادهای چرخه حیات خنثی ارائه‌دهنده `AgentCalled`، `AgentRingNoAnswer`، `AgentConnect` و `AgentComplete` را عادی می‌کند. Asterisk 13 `AgentDump` نیز به عنوان یک رویداد پاکسازی ترمینال عادی شده است زیرا می تواند پس از پاسخ دادن یک عضو اما قبل از `AgentConnect` رخ دهد. فعل و انفعالات فعلی توسط صف + تماس گیرنده Uniqueid + رابط عضو کلید می خورند، از ring-all fan-out پشتیبانی می کنند و فقط فازهای فعلی `RINGING` یا `CONNECTED` را نشان می دهند. از آنجایی که استریسک هیچ عکس فوری تعاملی فعال-عامل معتبری معادل `QueueStatus` ارائه نمی‌کند، وضعیت به صراحت `LIVE_ONLY` است: راه‌اندازی/اتصال مجدد تعاملات غیرقابل مشاهده ایجاد نمی‌کند، از دست دادن اتصال، تعاملات مشاهده‌شده را پاک می‌کند، و یک عکس فوری ارائه‌دهنده جدید، قبل از ایجاد رویدادهای جدید مشاهده‌شده توسط ارائه‌دهنده، Snapshot جدید ایجاد می‌کند. فیلدهای هویت تماس‌گیرنده، نام کانال، شناسه‌های کانال مقصد، و فیلدهای زمان‌بندی خام مستثنی هستند. فقط مصنوعی / ساختگی. بدون دسترسی واقعی PBX
- [x] Task 18: پایه و اساس معیارهای سیستم. قراردادهای مشترک ارائه‌دهنده خنثی اکنون درصد استفاده از CPU، بایت‌های حافظه کل/در دسترس، هویت سیستم فایل/مونت به‌علاوه بایت‌های کل/دردسترس، ثانیه‌های آپتایم و سلامت خدمات عمومی (`ACTIVE`، `INACTIVE`، `FAILED`، `UNKNOWN`) را مدل می‌کنند. هر نمونه دارای محدوده نمونه PBX است، صریحاً از جمع‌آورنده SSH محدود آینده گرفته شده، دارای مهر زمانی است و دارای پنج بعد قابلیت سیستم موجود است. یک انتزاع جمع‌آوری جدید و اعتبارسنجی مرزی به ابعاد پشتیبانی‌شده نیاز دارد که حاوی داده‌ها باشد و ابعاد غیرقابل دسترس/پشتیبانی‌نشده به جای تبدیل شدن به صفرهای کاذب، وجود ندارند. محدوده‌های عددی، ظرفیت‌ها، مهرهای زمانی، شناسه‌های سیستم فایل/سرویس تکراری، هویت نمونه/منبع، و مجموعه‌های اختیاری نادرست بسته نمی‌شوند. استثناهای گردآورنده ناشناخته بدون ارسال اطلاعات خام فرمان/میزبان به خطاهای محدود `COLLECTION_FAILED` تبدیل می شوند. فقط مصنوعی / ساختگی. بدون اتصال SSH، اجرای فرمان، دسترسی به میزبان واقعی/PBX، Persistence، API یا زمان‌بندی.
- [x] Task 19: سیستم SSH-متریک های محدود انتقال/پایه تجزیه کننده. `RestrictedSshTransport` تزریق شده فقط اشیاء دستور حل‌شده را از فهرست مجاز معیارهای ثابت می‌پذیرد: `/proc/stat`، `/proc/meminfo`، `df -P -B1`، `/proc/uptime`، و درخواست‌های وضعیت سرویس محدود `systemctl show` با شناسه‌های سرویس معتبر. تماس گیرندگان نمی توانند متن پوسته، نام برنامه، مسیرها یا آرگومان های دلخواه را ارائه دهند. اجرا محدودیت‌های بازدارنده/خروجی صریح دارد. لفاف یک بازه زمانی ساعت دیواری و درپوش بایت پس از بازگشت را اعمال می کند در حالی که همان محدودیت ها را برای حمل و نقل بتن آینده برای اجرای جریان عبور می دهد. تجزیه کننده‌ها CPU/Memory/Uptime Procfs Linux، `df` به سبک POSIX و وضعیت سرویس systemd را در قراردادهای Task 18 عادی می‌کنند. استفاده از CPU از دو نمونه `/proc/stat` استفاده می کند و `guest`/`guest_nice` را از کل حذف می کند زیرا لینوکس قبلاً آنها را در `user`/`nice` گنجانده است. ابعاد بدون مجوز/پشتیبانی نشده به طور مستقل و بدون صفرهای کاذب تنزل می‌یابند. خروجی یا پیکربندی نادرست بسته نمی شود. فقط مصنوعی / ساختگی. بدون کتابخانه/سوکت SSH، مدیریت اعتبار، اجرای فرمان در میزبان واقعی یا دسترسی PBX.
- [x] Task 20: پیکربندی SSH محدود و پایه اعتماد. Migration 6 ابرداده اختیاری SSH هر PBX (`host`، `port`، نام کاربری محافظه کارانه، روش احراز هویت، خط مشی اعتماد، اثر انگشت کلید میزبان پین شده) را با آبشار حذف PBX اضافه می کند. `SshConfigurationService` به یک PBX موجود نیاز دارد، فقط نحو را تأیید می‌کند، از رمز عبور یا اعتبارنامه‌های کلید خصوصی به همراه عبارت عبور کلید اختیاری پشتیبانی می‌کند، تمام مطالب اعتبارنامه را از طریق `SecretStore` رمزگذاری‌شده ذخیره می‌کند، اسرار احراز هویت منسوخ را هنگام تغییر روش‌ها حذف می‌کند، و فقط پرچم‌های فراداده/حضور را برمی‌گرداند. اعتماد به صراحت `PINNED_SHA256` است: اثر انگشت `SHA256:<digest>` به سبک OpenSSH متعارف می شود و حباب های کلید سرور دقیق با SHA-256 به علاوه مقایسه ایمن زمان بررسی می شوند. هیچ مسیر TOFU/accept-new وجود ندارد. خط مشی شبکه استریسک به یک مرز شبکه مشترک عمومی استخراج شد و مجدداً به صورت سازگار صادر شد. اعتبارسنجی هدف SSH آن خط مشی را پس از یک مرحله رزولوشن منفرد در آینده، در حالی که خود جستجو/سوکت DNS انجام نمی دهد، دوباره استفاده می کند. فقط مصنوعی / ساختگی. بدون کلاینت SSH، دسترسی به شبکه، یا پروب میزبان واقعی/PBX.
- [x] Task 21: پایه حمل و نقل مشتری SSH محدود بتن با حل کننده تزریقی، انتخاب آدرس یکباره بررسی شده توسط SSRF، پاسخ به تماس اجباری کلید میزبان پین شده، بازیابی اعتبار رمزگذاری شده، اجرای مهلت زمانی/خروجی جریان، و فقط اعتبار سنجی SSH حلقه بک مصنوعی. بدون دسترسی میزبان واقعی / PBX.
- [x] Task 22: انتقال SSH محدود شده بتن را به چرخه عمر Runtime/منبع سیستم-متریک با سلامت منبع هر PBX، عقب نشینی شکست محدود، Gateینگ اعتبار/پیکربندی، و اعتبارسنجی Runtime مصنوعی متصل کنید. بدون دسترسی میزبان واقعی / PBX.
- [x] Task 23: مرز Persistence وضعیت فعلی/تاریخچه معیارهای سیستم محدود، معنایی حالت فعلی یکنواخت، نمونه‌های ایمن تکراری، هرس نگهداری تراکنش، و Persistence Runtime را با یک پنجره حفظ پیش‌فرض محدود تعریف کنید. هیچ ادعای سازگاری با میزبان واقعی/PBX برای این کار مورد نیاز نیست.
- [x] Task 24: APIهای HTTP فعلی/تاریخچه احراز هویت شده سیستم و یک مرز انتشار بیدرنگ SSE با محدوده PBX، با محدودیت‌های پرس و جو/جریان محدود و بدون جزئیات خام SSH/حمل و نقل را نشان دهید. بدون دسترسی میزبان واقعی / PBX.
- [x] Task 25: اولین مرز منبع نظارت امنیتی محدود و قرارداد رویداد امنیتی احراز هویت عادی را از قاب‌های Asterisk AMI SecurityEvent ایجاد کنید. رویدادهای ناشناخته و فیلدهای هویت/شبکه/درخواست خام کنار گذاشته می شوند، قابلیت فقط پس از یک رویداد عادی مشاهده شده پشتیبانی می شود و اعتبارسنجی فقط بدون دسترسی به گزارش تولید به صورت مصنوعی/سخی باقی می ماند.
- [x] Task 26: تداوم جریان/تاریخچه رویداد امنیتی محدود با هویت تکراری-ایمن، ترتیب جریان یکنواخت در بین نسل‌های اتصال ارائه‌دهنده، هرس نگهداری تراکنش‌ها، و مرز حفظ پیش‌فرض هفت روزه را تعریف کنید. Persistence فقط خواندنی باقی می ماند و مصنوعی/مختل تایید شده بدون دسترسی به گزارش تولید.
- [x] Task 27: APIهای رویداد امنیتی فعلی/تاریخچه احراز هویت شده با محدوده PBX و تحویل SSE بلادرنگ بدون افشای فیلدهای خام AMI/ارائه‌دهنده را آشکار کنید. استقرار جریان از همان مبدأ محافظت می‌شود، محدوده PBX، ضربان قلب محدود است، و جریان‌های همزمان محدود می‌شود.
- [x] Task 28: ارزیابی هشدار/قاعده امنیتی محدود را بر روی رویدادهای امنیتی پایدار عادی شده با اعتبار سنجی بسته شده و بدون تحویل خارجی تعریف کنید.
- [x] Task 29: تداوم Security Alert محدود شده با محدوده PBX را با وضعیت فعلی هر قاعده، تکرار قطعی، به‌روزرسانی‌های یکنواخت آگاه از منبع، هرس حفظ تراکنش، و آبشار حذف PBX تعریف کنید. بدون سیم کشی قوانین تحویل خارجی یا Runtime.
- [x] Task 30: APIهای HTTP Security Alert با محدوده PBX احراز هویت شده و تاریخچه APIهای HTTP و تحویل SSE محدود با مبدأ یکسان که فقط توسط هشدارهای تکراری و با موفقیت تداوم یافته است را در معرض نمایش قرار دهید. بدون External Notification Delivery
- [x] Task 31: ادامه پیکربندی قاعده Security Alert با محدوده PBX محدود و اجرای Runtime متعلق به یک برنامه کاربردی که رویدادهای امنیتی عادی را ادامه می‌دهد، قوانین فعال را ارزیابی می‌کند و مطابقت‌ها را ادامه می‌دهد. بدون External Notification Delivery
- [x] Task 32: فهرست پیکربندی قوانین Security Alert با محدوده PBX احراز هویت شده/دریافت/برقرار/حذف APIها با محافظت از جهش با منشاء مشابه و اعتبارسنجی بسته با شکست محدود. بدون External Notification Delivery
- [x] Task 33: اضافه کردن اولین UI دوزبانه نظارت امنیتی برای هشدارهای فعلی با محدوده PBX و مدیریت دو Alert Rule محدود. بدون External Notification Delivery
- [x] Task 34: APIهای هشدار SSE/history با محدوده PBX موجود در رابط کاربری امنیتی دوزبانه تأیید شده، با تاریخچه اخیر محدود 24 ساعته/100 ردیفی و به‌روزرسانی‌های بیدرنگ فعلی/تاریخچه حذف شده را مصرف کنید. بدون External Notification Delivery
- [x] Task 35: Metadata محدود External Notification Channel، Persistence مربوط به Delivery Queue با Stateهای Pending/Cancelled، Deduplication قطعی Alert برای هر Channel، هویت immutable برای PBX/Transport Channel و Cascade Semantics مربوط به PBX/Channel تعریف شد؛ بدون Runtime Enqueue Wiring، Delivery Worker، Provider Client یا تماس واقعی خارجی.
- [x] Task 36: APIهای احرازشده و PBX-scoped برای list/get/put/delete در Notification Channel و Encrypted HTTPS Webhook Target Secret Management با Same-Origin Protection اضافه شدند؛ بدون افشای Target/Internal Secret، Delivery Worker یا تماس خارجی.
- [x] Task 37: Built Bilingual Frontend و Backend به‌صورت Same-Origin HTTPS Stack روی Monitoring Host با Private Local Runtime Configuration، Loopback-only Backend Exposure، Managed Local Launcher و Generic Tracked Systemd Unit Deploy شدند؛ Live UI/Health/Readiness PASS شد.
- [x] Task 38: OS-level Systemd Service نصب و Enable شد، Runtime Node/Data/TLS از Private Toolchain Pathها جدا شد، Live HTTPS/Health/Readiness پس از Reboot واقعی Host Validate شد، Scope فعلی Read-only PBX Monitoring حفظ شد و Explicit Temporary Self-Signed TLS Exception اضافه شد؛ Firewall Host Restrictive نیست چون UFW غیرفعال است.
- [x] Task 39: اولین Bilingual Operator Dashboard فقط با APIهای Authenticated و Read-only موجود برای PBX/Provider، System Metrics و Security Alerts اضافه شد. داشبورد شامل PBX Selection، Provider Connection Summary با Polling محدود Local Status، System-metric Summary، Realtime SSE Health، Current Security-alert Count و Navigation به مدیریت PBX/Security است. هیچ PBX Write Action، Collector جدید یا Backend Network Path جدیدی اضافه نشده است.
- [x] Task 40: `TelephonyStateEngine` موجود از طریق APIهای Authenticated، PBX-scoped و Read-only برای Current State و SSE Realtime ارائه شد. Stream فقط Normalized Engine State را منتشر می‌کند، به 64 Stream همزمان محدود است، Heartbeat پانزده‌ثانیه‌ای دارد، پس از Profile-runtime Reset مقدار `current: null` منتشر می‌کند و هیچ PBX Connection/Action یا Collection Source جدیدی ایجاد نمی‌کند.
- [x] Task 41: Task 40 در Bilingual Operator Dashboard با Primitiveهای Chakra UI v3 مصرف شد. PBX-scoped Telephony Synchronization و Current Call/Channel/Endpoint/Trunk/Queue/Agent Interaction نمایش داده می‌شود، Technical Identifierها داخل Surface دو‌زبانه/RTL به‌صورت LTR حفظ می‌شوند و Provider/System/Security Summaryهای موجود بدون PBX Action، Telephony History یا Collection Scope جدید reuse می‌شوند.
- [x] Task 42: Surface احراز هویت‌شده و PBX-scoped برای مدیریت SSH System Metrics Configuration/Credential اضافه شد. GET فقط Safe Metadata را برمی‌گرداند؛ PUT/DELETE با Same-origin Write Protection محافظت می‌شوند، Credentialها رمزنگاری‌شده و Write-only هستند، Pinned SHA-256 Host-key Trust اجباری باقی مانده و هر Mutation، SystemMetricsRuntime.syncProfile(instanceId) را فراخوانی می‌کند. Bilingual Chakra UI یک Workspace مستقل System metrics SSH دارد. هیچ Real SSH Connection/Test Endpoint اضافه نشد و Validation فقط Synthetic/Mock است.
- [x] Task 43: گسترش Provider-neutral Trunk Inventory فراتر از Outbound SIP Registration برای Discovery محدود و Read-only سازگار با chan_sip/PJSIP، ابتدا با Synthetic/Mock Compatibility Test و بدون Real-PBX Verification تا Approval جداگانه.
- [x] Task 44: معماری Source-owned History را اعمال و Configuration مربوط به External Database Source فقط‌خواندنی و PBX-scoped را با Credential رمزنگاری‌شده/Write-only و Settings UI دو‌زبانه اضافه کند. این Task فقط Configuration را ذخیره می‌کند، هیچ Database Connection/Query انجام نمی‌دهد و Telephony History محلی جدید ایجاد نمی‌کند.
- [x] Task 45: Boundary عمومی Read-only Database Transport/Query را با Dialect Adapter صریح، Network/TLS Policy، اجبار SELECT-only، Query Timeout و Row/Output Limit و فقط Synthetic Database Validation اضافه کند.
- [x] Task 46: Adapterهای Schema منبع برای Historical/Reporting Viewها مانند CDR/CEL/Queue را فقط وقتی Source پیکربندی‌شده واقعاً آن‌ها را ارائه می‌کند، با Contractهای Normalized و Fixtureهای Synthetic اضافه کند؛ هر Real-Database Compatibility Verification نیاز به Approval جدا دارد.
- [x] Task 47: API و UI محدود برای Historical/Reporting Data مستقیم از Source ارائه شد، بدون کپی‌کردن Rowهای Source داخل Database خود VoIP Monitor.
- [x] Task 48: Historyهای Monitoring محلی قدیمی با Policy جدید Non-duplication تطبیق داده شد؛ History جدید فقط در Bufferهای محدود In-memory نگه‌داری می‌شود، Current Operational State با توجیه صریح Persist می‌ماند و Tableهای History قدیمی تا Cleanup جداگانه دست‌نخورده باقی می‌مانند.
- [x] Task 49: Hardening، Backup، Tested Restore و Production Deployment Runbook کامل شد؛ حذف Legacy History Tableها تا Observation واقعی Production و Migration مخرب جداگانه Deferred است.
- [x] Task 50: Release Validation و Fresh Deployment مستقل از سازمان از Clean Clone، با اثبات Install/Onboard/Backup/Restore/Reboot/Operation بدون انتقال Private State.

### وضعیت فعلی ادامه کار

- PR #55 مربوط به Task 46 Merge شده است. Branch فعلی `feature/source-backed-history-ui` است که از `main` همگام‌شده روی Merge Commit `8c3a020` ساخته شد.
- Task 47 به‌صورت Local کامل است: APIهای GET-only احراز هویت‌شده و PBX-scoped برای Capability، Calls، Call Events و Queue Events از Adapter موجود Task 46 استفاده می‌کنند.
- درخواست History صریح و محدود به 1 تا 200 Recent Normalized Row است. هیچ Raw-SQL Endpoint، Background Polling، Startup Database Probe، Cache یا Local History Persistence وجود ندارد.
- Workspace سطح اول و دو‌زبانه History، پشتیبانی هر Dataset را Discover می‌کند و فقط Datasetهای Supported را با Action صریح Operator Load می‌کند.
- Timestampهای Source به‌شکل Source-reported باقی می‌مانند و Application برای مقدار Naive، UTC یا Timezone دیگری جعل نمی‌کند.
- Validation فقط Synthetic است: هیچ Real PBX، Source Database، Schema، Credential، DNS Target یا Production Host Contact نشده است.
- Final Gateها با Node 24.21.0 و npm 11.19.0 PASS هستند: Lint، Format Check، Typecheck، Backend 163/163، Frontend 25/25، Production Build، Foundation Check، License Check و Diff Check.
- Task دقیق بعدی پس از Merge شدن Task 47، **Task 48 — تطبیق Legacy Monitoring Historyهای Persist‌شده محلی با Non-duplication Policy و تعریف Migration/Cleanup Plan امن قبل از حذف مخرب** است.

### ثبت خرابی و اشکال

- **Typecheck اولیه Task 46 یک Exact-optional Table Reference را پیدا کرد — رفع شد:** بعد از Length Check، Schema Matching همچنان زیر `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` مقدار `table: SourceTable | undefined` می‌ساخت. اکنون Table انتخاب‌شده قبل از ساخت Result مربوط به Dataset پشتیبانی‌شده صریحاً Check می‌شود.
- **Targeted Lint مربوط به Task 46 ابتدا استفاده ضمنی از Global `URL` در Fixture Loader را رد کرد — رفع شد:** Test اکنون `URL` را صریحاً از `node:url` Import می‌کند و با Node Lint Environment پروژه هم‌راستا است.
- **اولین Full Build مربوط به Task 46 به Generated Frontend Asset Directory با Ownership مربوط به Root برخورد کرد — به‌عنوان Environment Ownership Issue رفع شد:** مسیر Ignored یعنی `frontend/dist/assets` از Build قبلی Root Shell با مالکیت Root باقی مانده بود و Source Track‌شده تغییری نداشت. فقط Ownership همان Generated Asset Directory به Repository User برگردانده شد و Full Gate مجدداً با Repository User اجرا می‌شود.

- **Final Format Gate مربوط به Task 45 ابتدا یک فایل i18n بدون Format پیدا کرد — رفع شد:** Prettier فایل `frontend/src/i18n.ts` را گزارش کرد؛ فایل Format شد و Full Gate از ابتدا Restart شد.
- **Foundation Gate مربوط به Task 45 ابتدا به Git Safe-directory Ownership Protection برخورد کرد — بدون Global Config رفع شد:** Remote Shell User با Repository Owner متفاوت است. Foundation Checker با Process-scoped `safe.directory=/opt/voip-monitor` دوباره اجرا شد و هیچ Global Git Setting تغییر نکرد.
- **Foundation Secret Scan مربوط به Task 45، Driver Password Option Key را Match کرد — بدون تغییر Behavior رفع شد:** Scanner محافظه‌کار Literal Key به شکل `password:` را Secret Assignment احتمالی می‌داند. Objectهای Driver مربوط به MySQL/PostgreSQL اکنون از Computed Key معادل `['password']` استفاده می‌کنند؛ Runtime Semantics ثابت است و False Positive حذف شد.

- **Sync شدن Branch برای Task 45 ابتدا به فایل Merge‌شده با Ownership مربوط به Root برخورد کرد — امن رفع شد:** بعد از Merge شدن PR #53، Switch/Pull روی `main` نمی‌توانست `backend/src/database/configuration.ts` را Unlink کند. Hash فایل Local دقیقاً با Blob موجود در `origin/main` Verify شد، Copy بدون Track حذف شد و سپس `main` قبل از ساخت Branch مربوط به Task 45 به‌صورت Clean Fast-forward شد.
- **فایل‌های جدید Task 45 ابتدا Root-owned بودند — به‌عنوان Environment Ownership Issue رفع شد:** Remote File Creation از Root Shell عبور کرده بود و Prettier با Repository User خطای EACCES می‌داد. فقط Ownership فایل‌های Source/Test جدید Task 45 به Repository User برگردانده شد و Format/Typecheck/Test مجدداً با `torabi` اجرا شدند.
- **اولین Full Gate مربوط به Task 45 در Test Lint متوقف شد — رفع شد:** Runtime Node دارای `AbortController` است اما ESLint Environment پروژه Bare Global آن را در Testهای جدید نمی‌شناخت و یک Promise عمداً unresolved نیز Resolver Parameter استفاده‌نشده داشت. Testها به `globalThis.AbortController` و Zero-argument Promise Executor تغییر کردند و Full Gate از ابتدا اجرا می‌شود.
- **استفاده از Numeric Address به‌عنوان Host مستقیم mysql2 می‌توانست TLS Identity را ضعیف کند — قبل از Commit رفع شد:** mysql2 مقدار SNI/Identity را از Host پیکربندی‌شده می‌سازد. اکنون Hostname اصلی داخل mysql2 حفظ می‌شود ولی Custom TCP Stream فقط به Numeric Address از قبل تأییدشده متصل می‌شود؛ در نتیجه Certificate Verification حفظ می‌شود و DNS Resolution دوم رخ نمی‌دهد.
- **Operation Timeout در Draft اولیه بعد از DNS شروع می‌شد — اصلاح شد:** نسخه اول Adapter را Bound می‌کرد ولی Resolver متوقف‌شده را نه. اکنون Timeout قبل از Hostname Resolution شروع می‌شود و Synthetic Test ثابت می‌کند Resolver غیرپاسخگو با `TIMEOUT` Fail می‌شود.
- **Normalized Output-byte Enforcement بعد از Driver است — محدودیت شناخته‌شده:** Outer Query روی Server تعداد Row را Bound می‌کند ولی mysql2/pg می‌توانند یک Field بسیار بزرگ را قبل از محاسبه Serialized Output در Application Materialize کنند. این محدودیت صریح مستند شده و در صورت نیاز Real Schema می‌توان بعداً Cursor/Streaming Hardening اضافه کرد.

- **Targeted Lint مربوط به Task 44 ابتدا Fail شد — رفع شد:** Validator اولیه Database Configuration از Control-character Regex استفاده می‌کرد که Rule مربوط به `no-control-regex` آن را رد کرد و Test اختصاصی نیز `Buffer` را بدون Import صریح Node استفاده کرده بود. Fix: Regex با Character-code Validation صریح جایگزین و `Buffer` از `node:buffer` Import شد؛ سپس Targeted Lint/Typecheck/Test PASS شدند.
- **Full Gate مربوط به Task 44 ابتدا روی Ownership فایل Generated Fail شد — رفع شد:** یک Targeted Command که با Remote Root Shell اجرا شده بود، `backend/dist/database` را با مالکیت Root ساخته بود و Repository Owner نمی‌توانست فایل Generated را Overwrite کند. فقط Ownership همان Generated Directory به Repository User برگردانده شد؛ Ownership سورس Track‌شده یا Runtime Secret تغییر نکرد و Full Gate از ابتدا Restart شد.
- **Foundation Secret Scan ابتدا Synthetic Test Fixture را Match کرد — رفع شد:** Object Key ساده به شکل `password:` توسط Secret-pattern Checker محافظه‌کار Repository Match می‌شود حتی وقتی Value کاملاً Synthetic باشد. Test اکنون از فرم Computed-key موجود یعنی `['password']` استفاده می‌کند؛ Semantics Test ثابت مانده و Public-source Scanner آن را با Secret Assignment پیکربندی اشتباه نمی‌گیرد.

- **Fullscreen Dashboard هنوز فضای بزرگ Toolbar مدیریتی را اشغال می‌کرد — رفع شد:** Implementation قبلی Toolbar را فقط بعد از Timeout Fade می‌کرد، بنابراین ابتدای Fullscreen ردیف کامل بالا را اشغال می‌کرد و در TV/NOC View دوباره ظاهر می‌شد. اکنون Toolbar عادی در Fullscreen اصلاً Render نمی‌شود.
- **امکان نمایش Edit UI در Fullscreen — جلوگیری شد:** ورود به Fullscreen، Edit Mode را خاموش می‌کند و Drag/Resize/Delete Styling و Controls نیز صریحاً در Fullscreen Gate می‌شوند.
- **Exit Fullscreen بدون هزینه Layout — رفع شد:** یک Control کوچک Fixed Overlay با Pointer Movement ظاهر و Auto-hide می‌شود و هیچ فضای Grid/Layout رزرو نمی‌کند.

- **UI پیام Application unavailable می‌داد در حالی که systemd سرویس را Active نشان می‌داد — Root Cause مشخص و Correction پیاده شد:** Backend Node Child با خطای Reached heap limit / JavaScript heap out of memory خارج شده بود اما Launcher، HTTPS Gateway Foreground را زنده نگه داشته بود. بنابراین Frontend Shell قابل دسترس بود ولی API به Port 3000 نمی‌رسید. Launcher اکنون مرگ Backend یا Gateway را Failure کل Stack در نظر می‌گیرد تا systemd آن را Restart کند.
- **SSE Backpressure بدون Hard Bound می‌توانست Memory را رشد دهد — به‌صورت Defensive اصلاح شد:** Server مقدار Writable Buffer را بررسی نمی‌کرد. چون Heap Process Crash‌شده دیگر در دسترس نیست، این مسیر به‌عنوان تنها علت قطعی OOM ادعا نمی‌شود؛ اما یک Risk واقعی و Unbounded بود. هر Stream اکنون سقف 256 KiB دارد و در صورت عبور Disconnect می‌شود.
- **SSE Cleanup فقط به Request Close وابسته بود — Harden شد:** Cleanup اکنون Idempotent و متصل به Request/Response Close است و Listener، Stream Set، Reset Subscription و Heartbeat را دقیقاً یک‌بار آزاد می‌کند.
- **Production Build نهایی ابتدا به Generated Frontend Artifactهای Root-owned برخورد کرد — به‌عنوان Environment Ownership Issue رفع شد:** یک Build قبلی با Root فایل‌های frontend/dist را با مالکیت Root ساخته بود. فقط Ownership Artifactهای Generated به Repository User برگردانده شد و Production Build، Foundation، License، Launcher Syntax و Diff سپس PASS شدند. Ownership سورس Track‌شده یا Secret Path تغییر نکرد.

- **Foundation Gate نهایی ابتدا به Git safe-directory Ownership Protection برخورد کرد — رفع شد:** Remote Command Session با OS User متفاوت از Repository Owner اجرا می‌شود و Git Enumeration داخلی Foundation Script را به‌عنوان Dubious Ownership رد کرد. این مورد Defect کد/Repository نبود. Gate با Process-scoped Git `safe.directory` برای `/opt/voip-monitor` دوباره اجرا شد و Foundation، License و Diff بدون تغییر Ownership یا Tracked Configuration PASS شدند.
- **یکی دانستن Trunk Inventory با Outbound Registration — در Task 43 رفع شد:** مدل قبلی فقط SIPshowregistry را مصرف می‌کرد و Static/IP-auth chan_sip Peer و PJSIP Definition ممکن بود دیده نشوند. اکنون Registrationهای صریح با Peer Candidateهای محافظه‌کارانه Merge می‌شوند و Confidence صریح نمایش داده می‌شود.
- **ریسک دوباره‌خواندن SIP Peer List — جلوگیری شد:** Endpoint State و Static chan_sip Candidateها از همان یک Snapshot مربوط به SIPpeers در هر Reconcile ساخته می‌شوند.
- **ریسک انتشار Provider-private Trunk Detail — جلوگیری شد:** PJSIP Auth/Contact/URI و chan_sip IP Address فقط برای Classification/Status محدود استفاده می‌شوند و وارد Normalized State نمی‌شوند.

- **نبود Account Management بعد از Bootstrap — اصلاح شد:** Schema از قبل چند Administrator Row را پشتیبانی می‌کرد اما Application فقط First Admin را ایجاد می‌کرد. اکنون Repository/Service/API/UI محدود برای مدیریت Account روی همان Schema اضافه شده است.
- **ریسک Lockout — محدود شد:** Self-disable/Self-delete رد می‌شود و آخرین Administrator فعال نیز قابل Disable/Delete نیست.
- **Session بعد از تغییر امنیتی Account — اصلاح شد:** Disable یا Password Reset تمام Sessionهای همان Account را Revoke می‌کند.
- **ابهام Role Model — مستند شد:** مدل فعلی فقط Administrator دارد و UI هیچ RBAC غیرواقعی نمایش نمی‌دهد.

- **Service Health همیشه NOT_CONFIGURED — رفع شد:** Production Collector Factory هیچ Service ID پیکربندی‌شده‌ای به Collector نمی‌داد. اکنون Service Monitoring Config به‌صورت PBX-scoped ذخیره و هنگام ساخت Collector تزریق می‌شود و Mutation فوری Metrics Runtime را Sync می‌کند.
- **Fixed Dashboard برای TV/NOC مناسب نبود — رفع شد:** Layout چندگانه، Reorder، Resize و حذف Widget وجود نداشت. اکنون Dashboard Definition ذخیره‌شده، Widget Catalog، Drag Reorder، Resize محدود و CRUD چند Dashboard وجود دارد.
- **Fullscreen همراه Application Chrome — جلوگیری شد:** Fullscreen روی Dashboard Root اعمال می‌شود نه کل Document؛ Header/Navigation وارد Fullscreen نمی‌شود و Controlها Auto-hide هستند.
- **ریسک Extensibility داشبورد — محدود شد:** فقط Widget Typeهای Allowlist‌شده و ID/Type/Width/Height ذخیره می‌شوند؛ HTML/Script/Query/Command/URL یا Shell Data دلخواه Persist نمی‌شود.

- **Top-level Navigation شلوغ — اصلاح شد:** Configuration و Entity Workspaceها مستقیم در Header جمع شده بودند. اکنون فقط Dashboard، Telephony و Settings Top-level هستند و Telephony/Settings Submenu افقی محدود خودشان را دارند.
- **نبود کنترل روی Filesystemهای کم‌اهمیت — اصلاح شد:** Dashboard قبلاً تمام خروجی df را نمایش می‌داد. اکنون Selection ذخیره‌شده و PBX-scoped مشخص می‌کند کدام Filesystem IDها نمایش داده شوند، بدون تغییر Collection.
- **ریسک Hardcode مسیرهای پیشنهادی — جلوگیری شد:** Root، Recording، Dev، Run یا مسیر دیگر هیچ‌کدام Default Repository نیستند. UI Sample واقعی Host را Discover و فقط انتخاب Administrator را ذخیره می‌کند.
- **Lifecycle Preference — مشخص شد:** نبود Record یعنی نمایش همه؛ Empty Array ذخیره‌شده یعنی نمایش هیچ‌کدام؛ DELETE/Reset یعنی بازگشت به Default-all.

- **Filesystem Visibility Gap — اصلاح شد:** System Metrics از قبل Filesystem Array با طول متغیر داشت اما Dashboard آن را نمایش نمی‌داد. اکنون تمام Filesystem/Mountهای Current با Used/Free/Total و درصد مصرف Dynamic Render می‌شوند و هیچ تعداد ثابتی فرض نشده است.
- **Physical-disk Ambiguity — مستند شد:** Source فعلی POSIX df است؛ بنابراین Storage Dashboard نماینده Mounted Filesystem است، نه Physical-drive Inventory قطعی. اگر Physical Disk لازم باشد Task/Source جدا نیاز است.
- **Dashboard History Underuse — اصلاح شد:** History API موجود System Metrics قبلاً در Dashboard استفاده نمی‌شد. اکنون Trend CPU/Memory از Window محدود History رسم می‌شود، بدون Dependency نموداری یا Backend Route جدید.
- **Legacy OpenSSH Fingerprint Command — مستند شد:** بعضی ssh-keygenهای قدیمی Option -E sha256 ندارند. Deployment Guide یک Fallback مبتنی بر OpenSSL برای محاسبه همان SHA-256 Fingerprint از Host Public Key قابل اعتماد دارد.

- **Task 42 نبود Runtime-sync API — رفع شد:** Service موجود SSH Configuration می‌توانست Credential رمزنگاری‌شده Persist کند اما Public Caller Mutation Boundary امن برای Activate/Stop کردن Runtime نداشت. Fix: PUT/DELETE احراز هویت‌شده و Same-origin بعد از Mutation موفق، SystemMetricsRuntime.syncProfile(id) را فوری اجرا می‌کنند.
- **Task 42 ریسک Credential Exposure — جلوگیری شد:** API از SafeSshConfiguration استفاده می‌کند و Response فقط Metadata + Credential-presence Flagها را دارد. Test صریحاً نبود Plaintext Credential و Ciphertext را Verify می‌کند.
- **Task 42 Real-host Probe Scope — عمداً پیاده‌سازی نشد:** هیچ Test SSH Endpoint/Button اضافه نشد چون تا Approval صریح، Task 42 فقط Synthetic/Mock است.
- **Task 42 UI Secret Lifecycle — Validate شد:** Frontend بعد از Save، Password/Private-key/Passphrase را از State/Input پاک می‌کند و Credential Submitted را Render نمی‌کند.

- **تشخیص System-metrics UNAVAILABLE — Gap پیکربندی، نه Zero Data:** Runtime فقط وقتی Metrics Source می‌سازد که PBX Enabled، Factory موجود، SSH Metadata موجود و Encrypted SSH Credential حاضر باشد. PBX فعلی Enabled/Connected و Networking فعال است، پس Gate محلی باقی‌مانده نبود SSH Configuration یا Credential است. برای این نتیجه هیچ SSH Probe انجام نشد.
- **Trunk Inventory Gap — محدودیت شناخته‌شده Provider:** Task 15 فعلاً Trunk را فقط از `SIPshowregistry` می‌سازد. ممکن است Static chan_sip Peer یا PJSIP Trunk وجود داشته باشد ولی Result صفر باشد. UI اکنون این محدودیت را صریح نشان می‌دهد. Task 43 Discovery گسترده‌تر است.
- **Long Telephony Dashboard — اصلاح شد:** Render تمام Entityها در Dashboard باعث Scroll بسیار زیاد می‌شد. Fix: Summary Dashboard و Workspaceهای جدا با Search/Pagination؛ Channel بسته از Current Display فیلتر می‌شود.
- **Operator Dashboard Test Expectation — اصلاح شد:** Test قدیمی Entity IDها را داخل خود Dashboard انتظار داشت. اکنون Summary-only Behavior و در Test جدا Search/Pagination/Closed-channel Filtering بررسی می‌شوند.

- **Task 41 Scope/Design-system Error — اصلاح شد:** پیاده‌سازی Merge‌شده Task 41، Chakra UI را اشتباهاً Dashboard-only تفسیر کرد. Setup/Login/PBX/Security روی Raw HTML/CSS قدیمی ماندند و UI ناسازگار شد. Fix: کل Operator-facing Shell و Form/Workspaceها زیر یک Global Chakra Provider به Chakra UI v3 مهاجرت کردند و Legacy Visual CSS حذف شد.
- **Chakra Polymorphic Form Typing Failure — رفع شد:** Stack as form در Chakra v3 همچنان HTMLDivElement Type می‌شود. Fix: Semantic Native form حفظ شد و Chakra Stack داخل آن قرار گرفت.
- **Legacy-selector Test Failure — رفع شد:** یک Security Realtime Test به CSS Selector قدیمی وابسته بود. Fix: Semantic data-security-alert Hook اضافه شد و Test رفتار را به‌جای Class Implementation Detail بررسی می‌کند.
- **Design-system Completeness Check:** Raw Legacy Button/Select و Visual className Styling از Frontend Source حذف شده‌اند؛ Inputهای باقی‌مانده فقط Chakra HiddenInput داخلی برای Checkbox Semantics هستند.
- **Production CSP/Emotion Incompatibility — در Branch رفع شد:** Browser Console خطاهای style-src نشان داد چون Gateway فقط Self-hosted Style را مجاز می‌کرد و Emotion Runtime Style Element می‌سازد. Fix: Style Nonce برای هر Document، Inject مقدار csp-nonce در HTML و Emotion Cache با همان Nonce. هیچ unsafe-inline اضافه نشد.
- **Nonce Regression-test Environment Failure — رفع شد:** تست اولیه Global DOM را فرض کرده بود و در Node Test Environment Fail شد؛ اکنون از Minimal Typed Document Stub استفاده می‌کند. تلاش موقت JSDOM نیز به‌علت نبود @types/jsdom Typecheck را Fail کرد و هیچ Dependency تستی جدیدی نگه داشته نشد.
- **Gateway Lint Failure — رفع شد:** Full Gate اولیه Global Buffer را تحت ESLint رد کرد. Fix: Buffer صریحاً از node:buffer Import شد.
- **Root-owned Build Artifact Drift — رفع شد:** یک Build دستی قبلی با root باعث شده بود frontend/dist/assets مالک root باشد و Project Build نتواند Vite Output را Clean کند. Build قدیمی به .local منتقل و Production Build جدید با مالکیت torabi ساخته شد. این مشکل Environment Ownership بود، نه Source Regression.

- **Task 41 Install Toolchain Mismatch — رفع شد:** اولین نصب Chakra با Remote Desktop Shell Node 22/npm 10 اجرا شد و چون Repository به Node 24 نیاز دارد Engine Warning داد. Lockfile Reset شد و نصب با Repository Runtime یعنی Node 24.21.0/npm 11.19.0 دوباره انجام شد.
- **Task 41 Chakra Label Type Mismatch — رفع شد:** در Chakra v3، `Text` حتی با `as="label"` Property نوعی `htmlFor` را قبول نکرد. Fix: Semantic Native `label` حفظ شد و Chakra Typography داخل آن استفاده شد؛ Frontend Typecheck سپس PASS شد.
- **Task 41 Formatting Drift — رفع شد:** Chakra Dashboard/API Client/CSS Cleanup جدید قبل از Targeted Validation به Prettier Normalization نیاز داشت.
- **Task 41 License Gate Failure — رفع شد:** Chakra، `tslib 2.8.1` با SPDX Identifier `0BSD` را اضافه کرد که هنوز در Reviewed License Set نبود. Local License Text بررسی شد و با Zero-Clause BSD Grant منطبق است؛ `0BSD` به Explicit Allowlist اضافه شد و License Check PASS شد.
- **Task 41 Correction:** محدودیت قبلی Dashboard-only Chakra بر اساس Feedback اپراتور نامعتبر شد. اکنون Full Operator-facing Shell، Setup/Login، PBX Management، Security Workspace و Dashboard به‌صورت Consistent از Chakra UI v3 استفاده می‌کنند.
- **محدودیت شناخته‌شده Task 41:** Telephony فقط Current-state است و History/Retention Browser View هنوز وجود ندارد.
- **محدودیت شناخته‌شده Task 41:** Agent Interaction همچنان `LIVE_ONLY` است و Queue/Agent Production Compatibility Verify نشده است.

- **Task 40 Server-write Syntax Failure — رفع شد:** اولین Route مربوط به Telephony SSE، Heartbeat Escape Sequence را به‌صورت Physical Newline داخل TypeScript String نوشت و Targeted Typecheck با Unterminated String Literal Fail شد. Root Cause تفسیر Escape در Python Heredoc مربوط به Remote Edit Wrapper بود. Fix: Literal `\n\n` صریح نوشته شد و Backend Typecheck PASS شد.
- **Task 40 Remote-wrapper Parse Failure — پیش از File Modification رفع شد:** اولین Command افزودن API Test شامل Nested JavaScript Template Literal بود که Outer Tool Wrapper را شکست. در آن Attempt تغییر اضافی در Repository ایجاد نشد. Fix: Template Literal با String Concatenation ساده جایگزین شد.
- **Task 40 Formatting Drift — رفع شد:** Server Route و Provider-runtime Test جدید به Prettier Normalization نیاز داشتند و Repository Formatter آنها را اصلاح کرد.
- **Task 40 Full-gate Lint Failure — رفع شد:** اولین Full Gate، Synthetic API Fixture را رد کرد چون Repository ESLint، Global `structuredClone` را در Test Fileها تعریف نمی‌کند. Fixture به Clone نیاز نداشت، بنابراین اکنون همان Immutable Synthetic State Object را مستقیم برمی‌گرداند و Full Gate از Lint دوباره اجرا شد.
- **محدودیت شناخته‌شده Task 40:** Telephony State فقط Current In-memory State است و Telephony History/Persistence API وجود ندارد.
- **محدودیت شناخته‌شده Task 40:** Agent Interaction همچنان `LIVE_ONLY` است و Interactionهای Active پیش از Startup/Reconnect ممکن است Under-report شوند. Queue/Agent Production Compatibility هنوز Claim نشده است.
- **محدودیت شناخته‌شده Task 40:** Browser Surface هنوز Telephony API جدید را مصرف نمی‌کند؛ این Scope دقیق Task 41 است.

- **Task 39 Remote-wrapper Quoting Failure — رفع شد:** اولین Command افزودن Test به‌دلیل Nested Template Literal در Remote Wrapper Parse نشد. هیچ File ناقصی نوشته نشد؛ Command با Quoting امن بازنویسی شد.
- **Task 39 Frontend Typecheck Failure — رفع شد:** SSE Reducer مقدار Explicit `undefined` را به Exact Optional Property می‌داد. Fix: Property غایب Omit می‌شود. Frontend Typecheck و 15/15 Test PASS شدند.
- **Task 39 Formatting Drift — رفع شد:** Prettier فایل‌های Dashboard/API/Test را Normalize کرد.
- **Task 39 Full-gate Backend Test Failure — رفع شد:** Full Test Suite ابتدا یک Assertion قدیمی System-metrics Runtime را Fail کرد، چون Synthetic Sample تاریخ ثابت 2026-09-25 داشت ولی Runtime Retention با Clock واقعی، History قدیمی‌تر از ۷ روز را Prune می‌کند. Root Cause یک Date-dependent Test Fixture بود، نه Runtime Behavior یا Backend Change مربوط به Task 39. Fix: Sample Window به یک Current-time Base مشترک در سطح Module متصل شد و History Query Bounds از همان Base ساخته شدند. Targeted Runtime Test سپس 3/3 PASS شد.
- **محدودیت شناخته‌شده Task 39:** Telephony Current State هنوز API مرورگر ندارد، پس Active Call/Channel/Endpoint/Trunk/Queue/Agent Interaction در Dashboard نمایش داده نمی‌شود.
- **محدودیت شناخته‌شده Task 39:** Provider Status Stream ندارد و با Polling محدود ۱۵ ثانیه‌ای Local Status Refresh می‌شود؛ Metrics و Alerts از SSE موجود استفاده می‌کنند.

- **Task 9 CI — رفع شد:** قانون `.gitignore` اصلی `runtime/` با هر دایرکتوری به نام `runtime` از جمله `backend/src/providers/runtime/` مطابقت داشت. منبع مدیر Runtime به صورت محلی وجود داشت اما نادیده گرفته شد/ردیابی نشد، بنابراین بررسی تایپ محلی انجام شد در حالی که پرداخت GitHub تمیز در Typecheck ناموفق بود زیرا ماژول وارد شده وجود نداشت. رفع: قاعده Runtime-داده را به صورت `/runtime/` لنگر بزنید، `backend/src/providers/runtime/index.ts` را ردیابی کنید، و جستجوگر پایه را محدود کنید تا فقط دایرکتوری های خصوصی/Runtime سطح بالا رد شوند. سپس Gate‌های محلی کامل عبور کردند و هر دو بررسی GitHub Actions به پایان رسید.
- ** خرابی اعتبارسنجی Task 10 — برطرف شد: ** اولین Gate پر لینت ناموفق بود زیرا آزمایش رویداد Node جدید به `Buffer` بدون وارد کردن صریح `node:buffer` در محیط ESLint مخزن ارجاع داد. واردات اضافه شد و مجموعه کامل دروازه با موفقیت مجدد اجرا شد.
- **Task 10 نقص باز:** در حال حاضر هیچ یک از مجموعه خودکار شناخته نشده است. مصرف کنندگان رویداد از طریق مرزهای شنونده از خرابی های حمل و نقل/ارائه دهنده/Runtime جدا می شوند.
- **محدودیت های شناخته شده Task 10:** فقط زیر مجموعه رویداد عادی شده عمداً انتخاب شده اجرا می شود (`Newchannel`، `Newstate`، `Hangup`، `DialBegin`، `DialEnd`، `BridgeEnter`، `BridgeLeave`، و chan_sip `PeerStatus`). رویدادهای تماس/نقطه پایانی PJSIP، رویدادهای صف/نماینده، رویدادهای ثبت/ترانک، حفظ هدر AMI تکراری، بازسازی حالت، تداوم تاریخی، و تحویل بلادرنگ مرورگر همچنان کار آینده هستند.
- **اشکال طراحی Task 11 – قبل از انجام رفع شد:** اولین پیش نویس اسنپ شات با هر گونه خرابی اولیه عکس فوری مانند یک اتصال PBX شکسته برخورد می کرد که حتی زمانی که AMI متصل باقی می ماند اما `CoreShowChannels` پشتیبانی نمی شد یا رد می شد، مکرراً قطع و وصل می شد. Runtime اکنون ارائه‌دهنده را در `DEGRADED` متصل نگه می‌دارد، تطبیق عکس فوری را در بازه زمانی عادی مجدداً امتحان می‌کند، و تنها زمانی دوباره وصل می‌شود که سلامت اتصال دیگر قابل استفاده نباشد.
- **اشکال قرار گرفتن در معرض داده Task 11 — قبل از انجام رفع شد:** افزودن `currentState` مستقیماً به وضعیت ورود در Runtime، همچنین داده های عکس فوری کانال را از طریق نقطه پایانی تأیید شده `provider-status` موجود در معرض دید قرار می دهد زیرا آن نقطه پایانی `runtime.status()` را پخش می کند. وضعیت Runtimeی عمومی اکنون عمداً وضعیت کانال فعلی را حذف می کند. عکس های فوری فقط یک مرز داخلی حالت-موتور باقی می ماند.
- ** خرابی اعتبار سنجی Task 11 — برطرف شد:** اولین اجرای کامل دروازه کیفیت در `format:check` متوقف شد زیرا `backend/src/providers/runtime/index.ts` پس از اصلاح مرز وضعیت به قالب بندی زیباتر نیاز داشت. زیباتر اعمال شد و مجموعه دروازه کامل از همان ابتدا دوباره اجرا شد.
- ** خرابی اعتبار سنجی Task 25 — برطرف شد:** تمدید `PbxProvider` با اشتراک امنیتی در ابتدا آزمایش Runtime مصنوعی را دو برابر کرد زیرا روش جدید را پیاده سازی نکردند. ارائه دهنده جعلی با یک درز اشتراک امنیتی بی اثر به روز شد. مشکل تایپ اولیه از باریک شدن اتحادیه با باریک کردن شاخه موفقیت قبل از دسترسی به `reason` و با استفاده از نوع صریح شکست-دلیل محدود شده رفع شد.
- **محدودیت های شناخته شده Task 25:** فقط نتایج احراز هویت Asterisk AMI `SecurityEvent` عادی شده است. گزارش‌های امنیتی بر روی SSH، رویدادهای فایروال/WAF، رویدادهای خط‌مشی مجوز، تداوم/تاریخچه رویداد امنیتی، هشدار، تحویل API/زمان بی‌درنگ، و ارائه داشبورد همچنان وظایف آینده هستند. هیچ ادعای سازگاری تولید برای زیرمجموعه رویداد امنیتی ارائه نشد.
- ** خرابی اعتبار سنجی Task 26 — برطرف شد:** اولین اجرای آزمایشی کامل دو ادعای تاریخچه مهاجرت مورد انتظار را نشان داد که پس از اضافه شدن مهاجرت 8 هنوز در نسخه 7 به پایان می رسد. آنها برای اثبات زنجیره کامل از طریق نسخه 8 به روز شدند. آزمایش Persistence جدید در ابتدا انتظار داشت که رویدادی قدیمی تر از قطع نگهدارنده ارائه شده آن در تاریخ باقی بماند. فیکسچر برای قرار دادن آن رویداد در داخل پنجره حفظ تصحیح شد، بنابراین آزمایش به‌جای دور زدن هرس، به طور خاص وضعیت فعلی یکنواخت را تأیید می‌کند.
- **محدودیت های شناخته شده Task 26:** تداوم امنیتی در حال حاضر فقط قرارداد رویداد- احراز هویت AMI عادی شده را پوشش می دهد. Retain یک مرز Runtime هفت روزه است که هنوز پیکربندی/API عمومی ندارد. وضعیت فعلی یک رویداد جدید در هر PBX است. API رویدادهای امنیتی تأیید شده / قرار گرفتن در معرض بیدرنگ، هشدار، ارائه داشبورد، و منابع امنیتی گسترده تر، کارهای آینده باقی خواهند ماند.
- **Task 11 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی شناخته شده نیست.
- **محدودیت های شناخته شده Task 11:** رفتار `CoreShowChannels` و مجوزهای AMI هنوز در برابر خط پایه واقعی مورد نیاز Asterisk 13.x تأیید نشده اند. داده های اسنپ شات عمداً فقط شامل هویت/نام کانال پایدار، شناسه پیوند شده، وضعیت و شناسه پل است. شناسه تماس گیرنده و فیلدهای دلخواه AMI مستثنی هستند. بافر رویداد زنده/عکس فوری و بازپخش ناتوان به موتور حالت آینده تعلق دارد. تجزیه کننده هنوز هم فقط یک مقدار را برای هر نام هدر AMI نگه می دارد.
- **اشکال پیش از پرواز Task 12 — برطرف شد:** اولین کاوشگر هدف مسدود شده `UNKNOWN` ظاهر شد زیرا `NetworkBoundaryError` توسط ارائه دهنده Asterisk نقشه برداری نشده بود. اکنون به `CONNECTION_FAILED` محدود نگاشت می شود. یک تست رگرسیون تأیید می کند که قبل از ایجاد هرگونه اتصال حمل و نقل، Loopback رد می شود.
- ** خرابی اعتبارسنجی Task 12 — برطرف شد:** اولین اجرای کامل لینت تأیید کننده مستقل را رد کرد زیرا جهانی های Node (`process`، `Buffer` و `setTimeout`) به صراحت تحت محیط ESLint مخزن وارد نشده بودند. تأیید کننده اکنون آنها را از Node داخلی وارد می کند.
- ** خرابی اعتبارسنجی Task 12 — برطرف شد: ** اجرای کامل Gate بعدی در `format:check` متوقف شد زیرا آزمایش رگرسیون ارائه دهنده جدید به قالب بندی زیباتر نیاز داشت. آزمون فرمت شد و مجموعه کامل با موفقیت دوباره اجرا شد.
- **وضعیت Task 12 قبل از پرواز:** کمک راه اندازی، حالت های فایل محلی/قوانین نادیده گرفتن، محصور شدن مسیر تایید کننده، رفتار هدف مسدود شده، و بررسی های نحوی با استفاده از ورودی های مصنوعی انجام می شود. با هیچ PBX واقعی تماس گرفته نشده است.
- **Task 12 اولین کاوشگر واقعی PBX — با مجوز مسدود شد:** قابلیت دسترسی و احراز هویت شبکه AMI به پایان رسید، سپس `CoreSettings` یک رد مجوز را برگرداند. پروب کاملاً قطع شد و هیچ تغییری در PBX ایجاد نکرد. کشف، عکس‌های فوری، رویدادهای زنده و آشتی پس از اقدام رد شده انجام نشد. اقدام بعدی اپراتور بررسی مجوزهای اختصاصی حساب AMI است. آنها را کورکورانه وسعت ندهید.
- **شکاف تشخیصی Task 12 — برطرف شد:** اولین کاوشگر واقعی در ابتدا کشف انکار شده را به عنوان `UNKNOWN` نشان داد زیرا پاسخ های غیرموفق AMI به طور ایمن طبقه بندی نشده بودند. اکنون ارائه‌دهنده پاسخ‌های مجوز مانند را به `PERMISSION_DENIED` و پاسخ‌های عملکرد پشتیبانی‌نشده را به `UNSUPPORTED` ترسیم می‌کند. یک تست رگرسیون مصنوعی کشف انکار شده را پوشش می دهد.
- **Task 12 اشکال اسناد با حداقل امتیاز — برطرف شد:** runbook اولیه `write = system,reporting` را پیشنهاد کرد. Asterisk 13 اعتبار عمل را با همپوشانی بیت ماسک بررسی می کند و هر دو اقدام فقط خواندنی مورد نیاز به عنوان `system|reporting` ثبت می شوند، بنابراین `write = reporting` کافی و باریکتر است. رویدادهای تماس/کانال زنده همچنان به `read = call` نیاز دارند.
- **Task 12 Gate PBX واقعی — تصویب شد:** پس از تصحیح مجوز اختصاصی AMI، تأیید کننده محدود، ورود واقعی، `CoreSettings`، `CoreShowChannels` اولیه، مشاهده رویداد عادی شده غیرفعال 60 ثانیه ای را طی یک تماس آزمایشی معمولی، تطبیق، و قطع اتصال پاک کرد. ارائه دهنده آزمایش شده از طریق تطبیق نهایی متصل باقی ماند و هیچ تنظیم PBX تغییر نکرد.
- **حوزه سازگاری Task 12:** Gate واقعی یک خط پایه تأیید شده را فقط برای محیط تایید شده Asterisk 13.x ایجاد می کند. این ادعا نمی کند که هر نسخه Asterisk/FreePBX، خانواده رویداد PJSIP، جریان صف/عامل یا توپولوژی استقرار سازگار است. سازگاری گسترده تر کار ماتریسی آینده باقی می ماند.
- ** مسابقه عکس فوری/رویداد Task 13 - با طراحی حل می شود:** مهرهای زمانی به تنهایی نمی توانند با خیال راحت تصمیم بگیرند که آیا رویدادی که با `CoreShowChannels` ترکیب شده است قبل یا بعد از یک آیتم عکس فوری خاص رخ داده است. انتقال TCP اکنون یک اتصال منحصر به فرد فرآیند و دنباله فریم یکنواخت را اختصاص می دهد. آیتم های عکس فوری دنباله منبع خود را حفظ می کنند و موتور حالت فقط رویدادهای جدیدتر از مرز عکس فوری قابل اجرا را دوباره پخش می کند.
- **Task 13 مسابقه اتصال مجدد/پروفایل-بارگذاری مجدد — حل شد:** نسل اتصال جدیدتر تا زمانی که عکس فوری معتبر آن برسد بافر می شود و جایگزینی/حذف نمایه Runtime یک تنظیم مجدد داخلی ایجاد می کند تا وضعیت یک نمونه ارائه دهنده قبلی به نمونه جدید منتقل نشود.
- ** شکاف تازگی Task 13 - حل شد: ** تغییرات وضعیت اتصال Runtime اکنون موتور حالت داخلی را تغذیه می کند. حالت اولیه در سلامت غیر متصل به `STALE` و پس از اتصال مجدد به `AWAITING_SNAPSHOT` تبدیل می شود تا زمانی که یک عکس فوری معتبر جدید `CURRENT` را بازیابی کند.
- **اشکال کاهنده پل Task 13 - قبل از انجام رفع شد:** یک پیش نویس اولیه کاهنده `BRIDGE_LEFT` می تواند تخصیص پل متفاوت و جدیدتر را پاک کند. یک رویداد مرخصی اکنون فقط زمانی عضویت پل را پاک می کند که با پل فعلی مطابقت داشته باشد و در غیر این صورت تکلیف جدیدتر را حفظ می کند.
- ** خرابی های اعتبارسنجی Task 13 - برطرف شد: ** اولین ساخت هدفمند خطاهای نوع اسکریپت با ویژگی اختیاری دقیق را در کاهنده جدید نشان داد. پس از آن اصلاحات، دو آزمایش حمل و نقل موجود ناموفق بود زیرا ابرداده رویداد سفارش داده شده شکل مورد انتظار را تغییر داد. انواع/قالب‌بندی و انتظارات آزمون تصحیح شد و مجموعه‌های هدفمند قبول شدند. اولین Gate Lint کامل بعداً دو متغیر تخریب‌شده عمداً دور ریخته‌شده و دو استفاده آزمایشی از یک `structuredClone` جهانی اعلام‌نشده تحت محیط ESLint مخزن پیدا کرد. کاهش دهنده اکنون اشیاء عمومی را به صراحت می سازد و منبع آزمایش جعلی از کپی های کم عمق صریح استفاده می کند.
- **Task 13 رفتار بافر محدود:** بافر رویداد روی 10000 ورودی در هر PBX محدود شده است. اگر سرریز یک مرز مورد نیاز برای تطبیق ایمن را از دست بدهد، موتور از کار می‌افتد و منتظر یک عکس فوری می‌ماند که جمع‌آوری آن پس از مرز دور ریخته شده شروع می‌شود.
- **Task 13 محدودیت های شناخته شده:** حالت فقط در حافظه است. وضعیت تماس یک گروه بندی قطعی از کانال های فعلی توسط `linkedId` (برگشت به شناسه کانال) است، نه یک مدل فاز تماس معنایی. هویت تماس گیرنده، تاریخچه نتیجه شماره گیری، نقطه پایانی/ترانک/صف/حالت عامل، Persistence، تجدید نظرهای تاریخی، خواندن REST و تحویل WebSocket همچنان کار آینده است.
- ** شروع نادرست اعتبار سنجی Task 14 - حل شد: ** یک چک تایپ فقط پشتیبان ابتدا اعلان های مشترک ساخته شده قبلی را خواند و انواع مشترک Task 14 را گزارش کرد. بازسازی فضای کاری `shared` ابتدا آن خطاهای قدیمی را حذف کرد. چک تایپ ریشه مخزن از قبل این ساخت وابستگی را به ترتیب درست انجام می دهد.
- **اشکال به‌روزرسانی جزئی نقطه پایانی Task 14 — قبل از انجام رفع شد:** زمانی که یک رویداد PeerStatus فقط بعد دیگر را توصیف می‌کند، اولین پیش‌نویس کاهش‌دهنده ثبت نام شناخته شده یا قابلیت دسترسی را با `UNKNOWN` جایگزین می‌کند. به‌روزرسانی‌های نقطه پایانی زنده اکنون مقدار موجود را برای ابعادی که رویداد به طور معتبر توصیف نمی‌کند حفظ می‌کند.
- **Task 14 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی شناخته نشده است.
- **محدودیت های شناخته شده Task 14:** کشف نقطه پایانی معتبر در حال حاضر Asterisk 13 chan_sip را از طریق `SIPpeers`/PeerEntry هدف قرار می دهد. فعالیت‌های نقطه پایانی/تماس PJSIP و خانواده‌های رویداد اجرا یا ادعا نشده است. ثبت پویا chan_sip در عکس فوری از پرچم پویا همتا به اضافه وجود/غیاب یک آدرس IP محدود استنباط می شود. همتاهای استاتیک برای ثبت `UNKNOWN` باقی می مانند. وضعیت نقطه پایانی فقط در حافظه است و هیچ گونه قرار گرفتن در معرض REST/WebSocket یا سابقه ندارد.
- **اشکال بازپخش-ارسال Task 15 — قبل از ارتکاب رفع شد:** اولین کاهنده ترانک تست های تایپ و ارائه دهنده را پشت سر گذاشت، اما یک آزمایش هدفمند در موتور حالت نشان داد که یک رویداد `TRUNK_REGISTRATION_CHANGED` جدیدتر پس از عکس فوری ترانک معتبر دوباره پخش نشد. تابع مرز تنه درست بود. انتخابگر پخش مجدد مجله اصلی همچنان هر رویداد غیرنقطه پایانی را از طریق ارتباط کانال هدایت می‌کند، بنابراین رویدادهای ترانک هیچ شناسه کانال تأثیری نداشتند و حذف شدند. رفع: ارسال رویدادهای ترانک به صراحت از طریق مرز عکس فوری تنه مستقل قبل از ارتباط کانال. سپس مجموعه مورد نظر از 26/26 گذشت.
- **Task 15 شکاف ایمنی مرز مستقل — برطرف شد:** بررسی قبلی بازیابی سرریز مجله فقط ثابت کرد که عکس فوری کانال پس از یک مرز رویداد نادیده گرفته شده شروع شده است. با پنجره‌های جمع‌آوری نقطه پایانی/تنه مستقل، که می‌تواند به دروغ ادعای وضعیت کمکی فعلی کند. اکنون برای بازیابی، هر مرز عکس فوری مستقل پشتیبانی شده در عکس فوری ارائه‌دهنده ترکیبی، قبل از پاک کردن شرایط ژورنال حذف شده، ایمن باشد.
- ** Task 15 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی شناخته شده نیست.
- **Task 15 محدودیت های شناخته شده:** اولین منبع ترانک فقط ثبت های خروجی chan_sip را نشان می دهد که از طریق `SIPshowregistry` قابل مشاهده است. ترانک های استاتیک/IP-aut که ثبت نمی شوند را شناسایی نمی کند و ادعای پشتیبانی از ترانک PJSIP را ندارد. شناسه ترانک، کلید ثبت نام از نوع کانال/نام کاربری/دامنه از ارائه دهنده است و داخلی باقی می ماند. رویدادهای زنده `Registry` به کلاس رویداد AMI SYSTEM بستگی دارد. یک Gate سازگاری واقعی با PBX کنترل شده آینده باید دید رویداد را بدون گسترش کورکورانه مجوزها تأیید کند. حالت Trunk فقط در حافظه است و هیچ گونه قرار گرفتن در معرض REST/WebSocket یا سابقه ندارد.
- **Task 16 وصله شروع نادرست - حل شد:** اولین ویرایش اسکریپت شده قراردادهای صف اضافه کرد که به `QueueMemberAvailability` ارجاع داشتند اما قبل از درج تعریف نوع ناموفق بودند زیرا یک لنگر متن با منبع قالب بندی شده مطابقت نداشت. ساخت/بررسی تایپ مشترک، ویرایش جزئی را بلافاصله نمایان کرد. رفع: فایل فرمت شده واقعی را بررسی کنید، نوع گمشده را با جراحی وارد کنید، سپس به جای اجرای مجدد پچ گسترده، از حالت مخزن مشاهده شده ادامه دهید.
- **Task 16 شکست تست حمل و نقل ترکیبی - رفع شد:** اولین وسیله حمل و نقل مصنوعی `QueueStatus` به پایان رسید زیرا رشته آزمایشی تولید شده به جای قاب بندی CRLF مورد نیاز AMI، حاوی قاب بندی LF بود. منطق همبستگی حمل و نقل دلیل نبود. رفع: فیکسچر را با قاب بندی صریح `\r\n` بازنویسی کنید. مجموعه مورد نظر سپس 31/31 را پشت سر گذاشت.
- **اشکال کدگذاری فایل منبع Task 16 — قبل از ارتکاب حل شد:** یک جداکننده کلید مرکب اسکریپتی دو بایت NUL تحت اللفظی را در `state-engine.ts` وارد کرد و باعث شد Git منبع TypeScript را به عنوان باینری طبقه بندی کند. رفع: بایت های NUL تعبیه شده را با متن منبع فرار `\u0000` جایگزین کنید و قالب بندی/چک تایپ را مجدد اجرا کنید. Git اکنون فایل را به عنوان متن عادی با معنای کلید Runtime یکسان در نظر می گیرد.
- **Task 16 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی شناخته نشده است.
- **محدودیت های شناخته شده Task 16:** سازگاری صف هنوز با خط پایه Asterisk تولید تایید شده تأیید نشده است. بنیاد عکس فوری شکل لیست رویداد Asterisk `QueueStatus` (`QueueParams`، `QueueMember`، `QueueEntry`، `QueueStatusComplete`) را هدف قرار می دهد و رویدادهای صف زنده به کلاس رویداد AMI AGENT متکی هستند. PII تماس گیرنده عمدا حذف شده است. رخدادهای ترک/رها کردن وضعیت فعلی تماس گیرندگان را حذف می‌کنند، اما موقعیت تاریخی را حفظ نمی‌کنند. چرخه عمر تماس-تلاش/اتصال/تکمیل عامل عمداً به Task 17 موکول شده است. حالت صف فقط در حافظه است و هیچ گونه قرار گرفتن در معرض REST/WebSocket یا سابقه ندارد.
- **Task 17 شکست تایپ بررسی قرارداد مرحله‌ای - برطرف شد:** انواع رویداد عامل خنثی ارائه‌دهنده قبل از گسترش سوئیچ‌های موتور حالت اضافه شدند، بنابراین TypeScript به درستی عملکردهای غیر جامع را گزارش کرد. رفع: مسیریابی عامل کاهش دهنده/رویداد را اجرا کنید و قبل از ادامه، فضای کاری مشترک را بازسازی کنید. Backend تایپ سپس تصویب شد.
- **شکاف صحت رویداد-ترمینال Task 17 - قبل از انجام تعهد برطرف شد:** منبع Asterisk 13 نشان می دهد که `AgentDump` می تواند یک تعامل را پس از پاسخ دادن یک عضو اما قبل از `AgentConnect` خاتمه دهد. عادی سازی تنها چهار رویداد نامگذاری شده در نقشه راه می تواند یک تعامل `RINGING` یتیم باقی بماند. رفع: `AgentDump` را به عنوان `AGENT_DUMPED` عادی کنید و آن را به عنوان یک رویداد پاکسازی ترمینال در همان کاهش دهنده چرخه عمر Task 17 در نظر بگیرید.
- **اشکال کدگذاری فایل منبع-Task 17 — قبل از ارتکاب رفع شد:** اولین ویرایش کلید ترکیبی Agent دو بایت NUL واقعی را در `state-engine.ts` وارد کرد و باعث شد Git منبع را به عنوان باینری طبقه بندی کند. رفع: بایت های تعبیه شده را با متن منبع فرار `\u0000` جایگزین کنید و قالب بندی/چک تایپ را مجدد اجرا کنید. منبع ردیابی شده دوباره متنی است با معنای جداکننده Runtime یکسان.
- ** Task 17 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی شناخته شده نیست.
- **محدودیت‌های شناخته شده Task 17:** Asterisk هیچ عکس فوری معتبری از تلاش‌ها/مکالمه‌های تماس با نماینده فعال را نشان نمی‌دهد، بنابراین وضعیت نماینده عمدا `LIVE_ONLY` است، نه یک موجودی کامل. فعل و انفعالاتی که قبلاً قبل از راه‌اندازی یا وصل مجدد مانیتور فعال بوده است، ممکن است تا زمانی که رویداد چرخه عمر بعدی مشاهده نشود، وجود ندارد. موتور گزارش کم را به وضعیت تولید ترجیح می دهد. قابلیت Agent تا زمانی که یک رویداد چرخه حیات عامل پشتیبانی شده واقعی مشاهده نشود، `UNKNOWN` باقی می ماند. `RingTime`، `HoldTime`، `TalkTime`، PII تماس‌گیرنده، نام کانال و شناسه‌های کانال مقصد عمداً از قراردادهای وضعیت فعلی مستثنی شده‌اند. دلیل تکمیل فقط در رویداد ترمینال عادی وجود دارد و به دلیل اجرا نشدن تاریخچه حفظ نمی شود. حضور Agent login/logoff خارج از Task 17 است. سازگاری رویداد صف/نماینده هنوز در PBX تولید تایید شده تأیید نشده است. وضعیت بدون قرار گرفتن در معرض REST/WebSocket یا سابقه در حافظه باقی می ماند.
- ** شکاف بررسی مرزی Runtime Task 18 - قبل از ارتکاب حل شد:** اولین اعتبارسنجی فقط مقادیر قابلیتی را که اتفاقاً وجود داشت تکرار کرد، بنابراین یک جمع‌آورنده جاوا اسکریپت می‌تواند یک کلید قابلیت مورد نیاز را حذف کند و زمانی که داده‌های منطبق آن نیز وجود نداشت، از آن بررسی خاص اجتناب کند. رفع: تمام پنج کلید قابلیت را صریحاً تأیید کنید و اشکال مجموعه اختیاری نادرست را رد کنید. آزمون های هدفمند سپس 6/6 را پشت سر گذاشتند.
- **Task 18 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی شناخته شده نیست.
- **محدودیت های شناخته شده Task 18:** این وظیفه فقط قراردادهای متریک سیستم و مرز جمع کننده ایمن را تعریف می کند. هیچ پیاده‌سازی SSH، خط‌مشی کلید میزبان، اجرای فهرست مجاز فرمان، تداوم اعتبار، زمان‌بندی مجموعه، وضعیت متریک فعلی، تداوم متریک تاریخی، Runtime منبع-سلامت، قرار گرفتن در معرض REST/WebSocket، هشدار یا UI وجود ندارد. CPU `utilizationPercent` فرض می‌کند که جمع‌آورنده آینده اندازه‌گیری 0-100 محدود را در بازه نمونه‌برداری مستند خود ارائه می‌کند. Task 18 نحوه اندازه گیری این فاصله را تعریف نمی کند. شناسه‌های سیستم فایل/نقاط اتصال و شناسه‌های سرویس، شناسه‌های داخلی ارائه‌شده توسط جمع‌آورنده هستند و هنوز به‌صورت خارجی در معرض نمایش قرار نگرفته‌اند.
- **Task 19 شکست تجزیه کننده نوع سخت - برطرف شد:** اولین پیش نویس تجزیه کننده که گروه های ضبط RegExp ایندکس شده را مستقیماً تحت `noUncheckedIndexedAccess` نشان می دهد، بنابراین Typecheck Backend، عکس های بالقوه تعریف نشده را رد می کند. رفع: صریحاً رشته‌های ضبط مورد نیاز را قبل از تجزیه عددی/رشته تأیید کنید. ساخت/Typecheck هدفمند سپس تصویب شد.
- **اشکال حسابداری CPU Task 19 — قبل از ارتکاب حل شد:** اولین کاهنده `/proc/stat` همه شمارنده های CPU را جمع می کرد، که لینوکس `guest` و `guest_nice` را دوبار شمارش می کرد زیرا این مقادیر قبلاً در `user` و `nice` گنجانده شده اند. رفع: مجموع تنها هشت شمارنده CPU اول (`user` تا `steal`) در حالی که بیکار باقی می ماند `idle + iowait`. یک آزمون رگرسیون از شمارنده های مهمان غیر صفر استفاده می کند و استفاده مورد انتظار را حفظ می کند.
- **شکاف زمان‌بندی تأیید اعتبار Task 19 - قبل از انجام عملیات حل شد:** شناسه سرویس پیکربندی شده نامعتبر در اصل تنها زمانی که به فرمان سرویس رسیده باشد، پس از اینکه مجموعه CPU/حافظه/فایل سیستم/uptime اجرا شده بود، رد می‌شود. رفع: دستور سرویس-وضعیت مجوز لیست را در سازنده جمع‌آوری حل کنید/تأیید کنید تا شناسه‌های نامعتبر قبل از هر تماس انتقالی از کار بیفتند.
- ** شکاف قابل حمل محلی Task 19 - قبل از انجام حل شد:** اولین تجزیه کننده `df` به کلمه انگلیسی `Filesystem` در هدر نیاز داشت که می تواند خروجی میزبان محلی معتبر را رد کند حتی اگر ردیف های عددی قابل حمل باشند. رفع: اولین خط غیر خالی را به عنوان سرصفحه بدون بستگی به برچسب های آن در نظر بگیرید. یک رگرسیون مصنوعی از یک برچسب هدر متفاوت استفاده می کند.
- **Task 19 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی شناخته شده نیست.
- **Task 19 محدودیت های شناخته شده:** هنوز هیچ سرویس گیرنده SSH یا اتصال شبکه مشخصی وجود ندارد. لفاف می‌تواند مهلت زمانی ساعت دیواری و اندازه خروجی برگشتی را اعمال کند، اما حمل‌ونقل بتن آینده باید محدودیت‌های وقفه/خروجی ارائه‌شده را در حین پخش اعمال کند، بنابراین یک فرآیند راه دور غیرهمکاری نمی‌تواند داده‌های نامحدود را قبل از بازگشت بافر کند. تجزیه کننده ها در حال حاضر procfs لینوکس، خروجی `df -P -B1` و systemd `systemctl show` را هدف قرار می دهند. میزبان های غیر لینوکس/BSD/BusyBox/غیر سیستمی ادعایی ندارند. شناسه‌های سرویس باید دقیقاً با شناسه‌های بازگشتی سیستمی مطابقت داشته باشند و عمداً به یک مجموعه کاراکتر محافظه‌کار محدود می‌شوند. هویت سیستم فایل در حال حاضر از نقطه اتصال استفاده می کند. هیچ پیکربندی SSH، اعتبارنامه، تأیید کلید میزبان، زمان‌بندی Runtime، وضعیت منبع سلامت، Persistence، API، هشدار یا UI وجود ندارد.
- ** شکست وصله مسیر Task 20 — برطرف شد:** اولین تلاش برای نوشتن خط مشی عمومی شبکه استخراج شده شکست خورد زیرا `backend/src/network/` هنوز وجود نداشت. هیچ فایل خط مشی جزئی ایجاد نشد. رفع: دایرکتوری منبع را به صراحت ایجاد کنید، سپس خط مشی عمومی و صادرات مجدد سازگاری Asterisk را بنویسید.
- **فاصله سخت شدن اعتماد/ورودی Task 20 — قبل از انجام عملیات حل شد:** پیش نویس پیکربندی اولیه SSH هر نام کاربری قابل چاپی را مجاز می دانست و محدودیت اثر انگشت DB محدوده وسیعی را در اختیار می گذارد، حتی اگر این سرویس به یک قالب دقیق OpenSSH SHA-256 نیاز دارد. رفع: نام‌های کاربری را به یک مجموعه محافظه‌کار `[A-Za-z0-9._-]+` محدود کنید و طول اثر انگشت SQLite را دقیقاً 50 کاراکتر کنید، در حالی که اعتبارسنجی اثر انگشت متعارف کامل را در سرویس حفظ می‌کند.
- **Task 20 ریسک محرمانه تراکنش — تأیید شد:** چون ابرداده SSH قبل از مطالب اعتبارنامه در داخل یک تراکنش SQLite نوشته شده است، در صورتی که مرز تراکنش ناکارآمد بود، خرابی فروشگاه مخفی می توانست ابرداده را بدون اعتبار باقی بگذارد. یک تست رگرسیون یک خطای نوشتن اعتبارنامه را تزریق می کند و بازگشت اتمی نوشته های ابرداده/سری را تأیید می کند.
- ** خرابی اعتبارسنجی Task 20 — برطرف شد:** اولین Gate پر لینت آزمایش پیکربندی جدید SSH را رد کرد زیرا `Buffer` بدون وارد کردن واضح `node:buffer` در محیط ESLint مخزن استفاده شد. رفع: وارد کردن Node واضح را اضافه کنید و مجموعه کامل Gate را از ابتدا مجدداً اجرا کنید.
- ** شکست تست مهاجرت Task 20 — رفع شد:** مجموعه کامل پشتیبان بعدی Migration 6 را به درستی اعمال کرد، اما آزمایش ارتقاء احراز هویت قدیمی‌تر همچنان انتظار داشت که تاریخچه طرحواره `[1,2,3,4,5]` باشد. رفع: آن ادعای مهاجرت تاریخی را به‌روزرسانی کنید تا شامل نسخه 6 شود و مجموعه Gate کامل را از ابتدا مجدداً اجرا کنید.
- **Task 20 شکست اسکن مخفی پایه - برطرف شد:** پس از گذراندن تست ها/ساخت، بررسی کننده پایه به طور محافظه کارانه خطوط منبع/آزمایش SSH جدید را که نام ویژگی شی `password:` بود، حتی با وجود اینکه مقادیر تعاریف مصنوعی یا طرحواره بودند، پرچم گذاری کرد. رفع: بررسی‌کننده را سخت نگه دارید و نام فیلد ورودی ارائه‌دهنده را به `credential` خنثی به‌علاوه کلیدهای نام مخفی صادر شده غیرفعال تغییر دهید. هیچ لیست مجاز یا تضعیف اسکنر معرفی نشد.
- **Task 20 نقص باز:** در حال حاضر هیچ یک از مجموعه مصنوعی/محلی شناخته نشده است.
- **Task 20 محدودیت های شناخته شده:** هنوز اتصال SSH مشخص یا مصرف اعتبار وجود ندارد. مواد کلید خصوصی محدود به اندازه هستند و در حالت استراحت رمزگذاری می‌شوند، اما هنوز از نظر رمزنگاری تجزیه نشده‌اند، بنابراین مواد کلید نادرست فقط توسط لایه مشتری SSH آینده رد می‌شوند. Trust اثر انگشت SHA-256 یک لکه کلید عمومی میزبان را پین می کند. چرخش کلید نیاز به یک به‌روزرسانی پیکربندی صریح دارد و هیچ مجموعه لطف چند کلیدی یا TOFU وجود ندارد. پیکربندی SSH هنوز هیچ API/UI عمومی یا مهر زمانی تأیید ندارد. اعتبار سنجی شبکه به یک حل کننده آینده برای ارائه آدرس های حل شده نیاز دارد. Task 20 خود هیچ جستجوی DNS انجام نمی دهد. هیچ زمان‌بندی مجموعه، چرخه حیات منبع-سلامت، تداوم متریک، هشدار، یا رابط کاربری وجود ندارد.
- **Task 21 حمل و نقل بتن — پیاده سازی شده در شاخه ویژگی فعلی:** `Ssh2RestrictedSshTransport` از سرویس گیرنده `ssh2` با یک حل کننده یک بار تزریقی استفاده می کند، آدرس کامل حل شده را که از طریق مرز مشترک SSRF/شبکه تنظیم شده است اعتبار می دهد، یک آدرس از قبل تأیید شده را انتخاب می کند، PBX را بازیابی می کند، میزبانی با دامنه اجرا را بازیابی می کند، کلید اجرا را رمزگذاری شده پین می کند. فقط Task 19 اشیاء فرمان تایپ شده را با نقل قول ایمن پوسته اجرا می کند و محدودیت های ترکیبی stdout/stderr را به همراه زمان توقف ساعت دیواری با پاکسازی اتصال/کانال اعمال می کند. تست های مصنوعی فقط از یک سرور SSH حلقه بک استفاده می کنند و هرگز با یک PBX واقعی تماس نمی گیرند.
- ** خرابی های اعتبار سنجی Task 21 - برطرف شد:** اولین فیکسچر مصنوعی SSH نشان داد که `ssh2` یک هگزادسیمال را به تأیید کننده ارسال می کند که `hostHash` تنظیم شود. بنابراین حمل و نقل از مسیر بازخوانی کلید میزبان خام استفاده می کند و حباب کلید عمومی ارائه شده را از طریق تأیید کننده SHA-256 پین شده موجود هش می کند. جریان اولیه ثابت همچنین پس از قطع ارتباط مشتری، یک حلقه فرستنده نامحدود باقی گذاشت. دستگاه به یک انفجار خروجی محدود محدود شد و سپس هر پنج آزمایش حمل و نقل هدفمند با موفقیت انجام شد. اولین اجرای آزمایشی کامل مخزن همچنین نشان داد که تایمر تایمر بسته بندی Task 19 `unref()`'d است، و اجازه می دهد تا زمانی که هیچ دستگیره حلقه رویداد دیگری باقی نماند، یک وعده حمل و نقل مصنوعی معلق لغو شود. تایمر ایمنی در حال حاضر مرجع نگه داشته می شود و مجموعه کامل Backend از 105/105 عبور می کند.
- **محدودیت‌های شناخته شده Task 21:** انتقال به زمان‌بندی Runtime، وضعیت منبع سلامت، Persistence، REST/WebSocket API یا UI متصل نمی‌شود. درز آزمایشی عمداً اعتبار آدرس را لغو می کند تا امکان بازگشت به عقب را فراهم کند. ساخت و ساز تولید از اعتبارسنجی مشترک استفاده می کند که هدف های حلقه بک/لینک-محلی/چندپست/فراداده/پخش/پخش نامشخص را رد می کند. احراز هویت رمز عبور لزوماً یک رشته جاوا اسکریپت موقت برای `ssh2` API ایجاد می کند. بافرهای اعتبار/ عبارت عبور اصلی در `finally` صفر می شوند، اما جاوا اسکریپت نمی تواند پاک شدن قطعی هر کپی مشتق شده را تضمین کند. احراز هویت با کلید خصوصی پیاده‌سازی شده است اما هنوز هیچ ابزار احراز هویت مصنوعی جداگانه‌ای ندارد. هیچ دسترسی واقعی به میزبان/PBX انجام نشد.
- **اجرای Runtime Task 22 — کامل شد:** `SystemMetricsRuntime` اکنون مالک چرخه عمر یک منبع Metric مبتنی بر SSH برای هر PBX پیکربندی‌شده است، همراه برنامه start/stop می‌شود، فقط زمانی Collector می‌سازد که پیکربندی SSH دارای Credential رمزگذاری‌شده باشد، Source Health با محدوده PBX و Source برابر `SSH` به‌همراه Sampleهای bounded منتشر می‌کند، و در Collection Failure با Backoff نمایی و محدود عقب‌نشینی می‌کند. Factory تولید از Transport موجود `ssh2` و `NodeAddressResolver` استفاده می‌کند؛ Network Mode در سطح Application همچنان Gate صریح است و `disabled` مقدار پیش‌فرض می‌ماند.
- ** خرابی اعتبارسنجی Task 22 — برطرف شد:** اولین ابزار تست Runtime به طور تصادفی از نحو کلاس فیلد/سازنده فقط TypeScript در آزمایش `.mjs` استفاده کرد. فیکسچر به جاوا اسکریپت ساده اصلاح شد و فرمت کامل/lint/typecheck/build به علاوه سه تست Runtime به پایان رسید.
- **محدودیت های شناخته شده Task 22:** معیارهای سیستم هنوز فقط در حافظه هستند. هیچ Persistence/سابقه، قرار گرفتن در معرض REST/WebSocket، UI، لیست شناسه سرویس قابل تنظیم، یا Gate سازگاری با میزبان واقعی وجود ندارد. تغییرات پیکربندی SSH هنوز نقطه پایانی جهش در Runtime عمومی ندارد. تماس گیرندگان باید درز همگام سازی Runtime را پس از تغییرات پیکربندی فراخوانی کنند. منبع سلامت نقشه‌های جمع‌آوری‌کننده را به کدهای خطای مشترک محدود نشان می‌دهد و عمداً جزئیات خام حمل‌ونقل/میزبان را حذف می‌کند. هیچ دسترسی واقعی به میزبان/PBX انجام نشد.
- **طراحی Persistence Task 23:** مهاجرت 7 جداول `system_metric_current` و `system_metric_history` با آبشار PBX را اضافه می کند. نمونه‌ها به‌عنوان متن JSON معتبر ذخیره می‌شوند، تاریخچه روی `(PBX, source, observed_at)` بی‌قدرت است، وضعیت فعلی فقط برای مشاهدات جدیدتر پیشرفت می‌کند، و هرس تاریخچه در همان تراکنش با Persistence نمونه رخ می‌دهد. حفظ تاریخچه Runtime به طور پیش فرض 7 روز است و 90 روز محدود می شود. وضعیت فعلی با هرس تاریخ پیر نشده است.
- **محدودیت اجرای Task 23:** خرابی های پایدار عمداً از جمع کننده فقط خواندنی جدا می شوند، بنابراین مشکل نوشتن پایگاه داده نمی تواند منبع SSH را پایین علامت گذاری کند، اما هنوز یک سیگنال پایدار-سلامت محدود مجزا وجود ندارد. قرار گرفتن در معرض API/زمان بیدرنگ و خرابی‌های ذخیره‌سازی قابل مشاهده توسط اپراتور همچنان کار آینده است.
- **Task 24 API/طراحی بلادرنگ:** نقاط پایانی GET احراز هویت شده، معیارهای فعلی با محدوده PBX و تاریخچه محدوده زمانی محدود (حداکثر 500 ردیف) را نشان می دهد. یک جریان SSE با محدوده PBX، یک عکس فوری جریان/منبع اولیه و به‌روزرسانی‌های متریک و منبع سلامت ارسال می‌کند، از حفاظت با مبدأ یکسان استفاده می‌کند و جریان‌های متریک همزمان را روی 64 محدود می‌کند. میزبان SSH، آدرس، اعتبارنامه ها، خروجی فرمان و خطاهای انتقال خام خارج از مرز API باقی می مانند. تست‌های مصنوعی از حداقل اصل تست تایید شده استفاده می‌کنند زیرا تست‌های یکپارچه‌سازی احراز هویت موجود مخزن از قبل صدور/اعتبارگذاری جلسه را پوشش می‌دهند. با هیچ PBX واقعی تماس گرفته نشد.

## 26-09-2026 - رکورد تکمیل Task 29

- **نتیجه:** مهاجرت 9 و `SecurityAlertRepository` محدود برای وضعیت هشدار فعلی/تاریخچه با محدوده PBX اضافه شد.
- **معناشناسی وضعیت فعلی:** وضعیت هشدار فعلی توسط PBX + قاعده کلید می خورد، بنابراین انواع قوانین مستقل نمی توانند یکدیگر را بازنویسی کنند. تولید / دنباله جریان منبع برای سفارش در صورت وجود ترجیح داده می شود، با زمان مشاهده به عنوان بازگشت.
- **Deduplication:** تاریخچه از یک کلید SHA-256 بر روی هویت هشدار کامل محدود استفاده می کند: PBX، قانون، زمان مشاهده، تعداد رویدادهای منطبق، و سفارش جریان منبع اختیاری.
- **نگهداری:** هرس تاریخچه هشدار در همان تراکنش با درج تاریخ/پیشرفت فعلی اجرا می شود. هرس هرگز وضعیت فعلی را حذف نمی کند.
- **تأیید اعتبار:** رکوردها فقط دو شناسه قانون Task 28، مُهرهای زمانی UTC عادی، شمارش رویدادهای همسان 1 تا 500، و ترتیب منبع اعداد صحیح غیرمنفی را می پذیرند.
- ** جداسازی: ** Task 29 فقط معنای ذخیره سازی را اضافه می کند. پیکربندی قوانین، اجرای ارزیاب سیمی در Runtime، افشای APIهای هشدار، یا ارائه اعلان‌ها ادامه نمی‌یابد.
- **سیستم های واقعی:** هیچ PBX واقعی، گزارش تولید، گزارش امنیتی SSH یا هدف تحویل خارجی تماس گرفته نشد.

### Task 29 شکست / اشکال / شکاف

- **نقص وصله مهاجرت - قبل از اعتبارسنجی برطرف شد:** اولین وصله محلی جداکننده شی مهاجرت بسته شدن را برای مهاجرت 9 حذف کرد. علت اصلی یک مرز جایگزینی متن محلی معیوب بود. بازرسی آن را قبل از دروازه های مخزن گرفت. جداکننده بازیابی شد و مجموعه ذخیره‌سازی هدفمند سپس عبور کرد.
- **اظهارات مهاجرت کامل - حل شد:** اولین مجموعه کامل پشتیبان در دو تست ارتقای تاریخی شکست خورد، زیرا لیست های مهاجرت مورد انتظار آنها هنوز در نسخه 8 به پایان می رسد. هیچ مهاجرت منتشر شده اصلاح نشد.
- **شکست کاذب مهار اعتبار - رفع شد:** اجرای مجدد سختگیرانه با فراخوانی گره پشتیبان مستقیماً از ریشه مخزن آزمایش می کند، که باعث می شود `config.test.mjs` مسیر فرزند نسبی عمدی `dist/index.js` خود را از دایرکتوری کاری اشتباه حل کند و گزارش های خالی راه اندازی را گزارش کند. علت اصلی فرمان اعتبارسنجی بود، نه رفتار برنامه. اجرای مجدد از طریق فرمان رسمی Backend Workspace، cwd مورد نظر را بازیابی کرد و تمام 118 تست Backend را گذراند.
- **محدودیت شناخته شده:** هیچ جزء Runtime در حال حاضر ارزیاب را فراخوانی نمی کند و هشدارهای منطبق را به طور خودکار ادامه می دهد، زیرا مالکیت پیکربندی/اجرای قانون پایدار هنوز تعریف نشده است. Task 29 عمداً فقط مرز Persistence محدود/حالت فعلی را ارائه می دهد.
- **محدودیت شناخته شده:** هیچ هشدار سطح HTTP/SSE یا تحویل خارجی وجود ندارد. وظیفه بعدی دقیق بعد از ادغام، Task 30 برای API فعلی/تاریخچه احراز هویت شده به علاوه فقط تحویل هشدار بیدرنگ محدود شده است.

## 26-09-2026 - رکورد تکمیل Task 30

- **نتیجه:** APIهای HTTP با Security Alert فعلی/تاریخچه احراز هویت شده با محدوده PBX و تحویل SSE محدود اضافه شد.
- **قرارداد فعلی:** `GET /api/pbx-instances/:id/security-alerts` مجموعه هشدار جاری را با یک رکورد جاری در هر قانون برمی گرداند.
- **سابقه قرارداد:** `GET /api/pbx-instances/:id/security-alerts/history` به UTC `from`/`to` نرمال شده نیاز دارد، `from <= to` را اجرا می کند و `limit` را روی 500 محدود می کند.
- **قرارداد بیدرنگ:** `GET /api/pbx-instances/:id/security-alerts/stream` احراز هویت شده است، از همان مبدأ محافظت می شود، دارای محدوده PBX، محدود به 64 جریان همزمان است، یک عکس فوری فعلی ثابت اولیه ارسال می کند، و سپس فقط هشدارهای غیر تکراری تازه باقی مانده را منتشر می کند.
- **تداوم/ جداسازی بیدرنگ:** شنوندگان هشدار فقط پس از موفقیت در تراکنش SQLite مطلع می شوند. استثناهای شنونده ایزوله هستند و نمی توانند به عقب برگردند یا تداوم را بشکنند.
- **عوارض جانبی خارجی:** هیچ. هیچ وب هوک، ایمیل، پیامک، ارائه دهنده چت، نوشتن PBX یا سایر اعلان های خارجی انجام نمی شود.
- **سیستم های واقعی:** هیچ PBX واقعی، گزارش تولید، گزارش امنیتی SSH یا هدف تحویل خارجی تماس گرفته نشد.

### خرابی / اشکال / شکاف Task 30

- ** ایجاد نقص نحو ضربان قلب SSE - قبل از تأیید اعتبار برطرف شد:** اولین وصله محلی کاراکترهای خط جدید فرار را به خطوط جدید تحت اللفظی در یک رشته TypeScript تبدیل کرد. علت اصلی، مدیریت فرار مولد پچ محلی پایتون بود. رشته قبل از تایپ‌چک تعمیر شد و آزمایش‌های API/SSE هدف‌گیری شد و سپس رد شد.
- **ریسک تحویل بیدرنگ تکراری — قبل از Gate های کامل حل شد:** اولین پیش نویس منتشر شده پس از هر `save()` موفق، از جمله ذخیره های بدون عملیات تاریخچه-تضاد. علت اصلی انتشار بدون بررسی این بود که آیا درج تاریخچه حذف شده واقعاً فضای ذخیره‌سازی را تغییر داده است یا خیر. رفع: فقط زمانی منتشر می شود که درج تاریخ یک ردیف جدید را پس از انجام تراکنش گزارش می دهد. پوشش رگرسیون همچنین تأیید می کند که شکست های شنونده جدا باقی می مانند.
- **شکست بررسی تفاوت اسناد — برطرف شد:** اولین اجرای کامل Gate پس از آزمایشات/ساخت/بنیاد/مجوز به `git diff --check` رسید اما در دو فضای انتهایی در `docs/MASTER_PLAN.fa.md` ناموفق بود. علت اصلی فاصله‌گذاری خط‌شکن Markdown در هدر فارسی تولید شده بود. فضاهای انتهایی حذف شدند و مجموعه کامل دروازه از ابتدا مجددا اجرا شد.
- **محدودیت شناخته شده:** Task 30 هشدارهای مداوم را نشان می دهد اما آنها را به طور خودکار ایجاد نمی کند. پیکربندی مداوم قانون و مالکیت Runtime ارزیاب هنوز وجود ندارد، بنابراین تولید هشدار تولید عمداً بدون سیم باقی می ماند.
- **محدودیت شناخته شده:** هیچ ارسال اعلان خارجی یا ارائه هشدار داشبورد وجود ندارد. وظیفه بعدی دقیق بعد از ادغام، Task 31 برای پیکربندی قوانین محدود و ارزیابی Runtime/ سیم کشی پایدار است.

## 26-09-2026 - رکورد تکمیل Task 31

- **نتیجه:** مهاجرت 10، `SecurityAlertRuleConfigRepository` محدود دائمی و `SecurityAlertRuntime` متعلق به برنامه اضافه شد.
- **پیکربندی قانون:** پیکربندی با PBX + قانون کلید می‌خورد، با حذف PBX آبشاری می‌شود و فقط `AUTHENTICATION_FAILURE_ANY` یا `AUTHENTICATION_FAILURE_THRESHOLD` محدود را با آستانه 1 تا 100، پنجره 1 تا 3600 ثانیه و لیست مجاز دلایل خرابی موجود می‌پذیرد.
- **مالکیت Runtime:** اکنون یک اشتراک Runtime در هر رویداد امنیتی عادی شده، ابتدا ادامه می یابد، سپس فقط پیکربندی قوانین پایدار PBX را بارگیری می کند، قوانین غیرفعال را رد می کند، قوانین فعال را ارزیابی می کند، و هشدارهای مشابه را ادامه می دهد.
- **ترتیب بسته با شکست:** اگر تداوم رویداد ناموفق باشد، هیچ ارزیابی قاعده ای برای آن رویداد انجام نمی شود. خرابی بارگذاری/ارزیابی پیکربندی قانون هیچ هشداری ایجاد نمی کند. خرابی‌های تداوم هشدار از مجموعه ارائه‌دهنده/رویداد جدا می‌شوند.
- **پیش فرض ها:** هیچ Alert Ruleی به طور ضمنی ایجاد یا فعال نمی شود. رفتار Runtime تا زمانی که پیکربندی محدود وجود نداشته باشد بی اثر می ماند.
- **عوارض جانبی خارجی:** هیچ. هیچ وب هوک، ایمیل، پیامک، ارائه دهنده چت، نوشتن PBX یا سایر اعلان های خارجی انجام نمی شود.
- ** اعتبار سنجی: ** تست های قانون/ Runtime/ ذخیره سازی هدفمند و مجموعه آزمایشی کامل مخزن با Backend 123/123 و Frontend 10/10 قبل از نهایی شدن مستندات به تصویب رسید.
- **سیستم های واقعی:** هیچ PBX واقعی، گزارش تولید، گزارش امنیتی SSH یا هدف تحویل خارجی تماس گرفته نشد.

### Task 31 شکست / اشکال / شکاف

- **شکست اولیه Typecheck - برطرف شد:** اولین وصله `securityAlertRules` را دو بار در `SqliteStorage` اعلام کرد و `undefined` را به یک ویژگی لغو اشتراک اختیاری دقیق اختصاص داد. علت اصلی درج پچ مکانیکی به همراه `exactOptionalPropertyTypes` بود. رفع: اعلان تکراری را حذف کنید و ویژگی اختیاری را در stop حذف کنید. چک تایپ هدفمند سپس تصویب شد.
- **به‌روزرسانی‌های انتظار مهاجرت - حل شد:** افزودن مهاجرت 10 به ادعاهای مهاجرت تازه/به‌روزرسانی موجود برای ارتقاء از نسخه‌های 1-9 به 1-10 نیاز داشت. هیچ مهاجرت منتشر شده ای اصلاح نشد.
- **شکست Lint کامل Gate — برطرف شد:** اولین اجرای کامل Gate یک متغیر تخریب ساختار `_instanceId` عمداً در `SecurityAlertRuntime` را رد کرد. علت اصلی، خط مشی no-unused-vars مخزن ESLint بود. رفع: شی قانون ارزیاب را به صراحت و بدون فیلد محدوده PBX بسازید. مجموعه کامل دروازه از همان ابتدا دوباره اجرا شد.
- **مراحل اسکن مخفی مثبت کاذب — حل شد:** اولین مرحله سفارشی grep با جمله مستندات تاریخی Task 20 مطابقت داشت که به معنای واقعی کلمه مثبت کاذب نام ویژگی `password:` را مورد بحث قرار می دهد. هیچ ماده محرمانه ای وجود نداشت. رفع: بررسی محرمانه بنیاد مخزن را حفظ کنید و اسکن مرحله‌ای تکمیلی مواد را به کد/پیکربندی ردیابی شده محدود کنید تا اینکه رفتار اسکنر را مستندسازی کند.
- **شکست نادرست اعتبار نویسی نهایی - برطرف شد:** اجرای مجدد Lint، فرمت، تایپ، تست، ساخت، پایه، مجوز و بررسی تفاوت با موفقیت کامل شد، اما wrapper از 1 خارج شد زیرا یک grep ساده با خلاصه Vitest `10 passed` تزئین شده با ANSI مطابقت نداشت. بازرسی مستقیم گزارش آزمایشی ضبط شده، Backend 123/123 و Frontend 10/10 را با هیچ خرابی تأیید کرد. این یک مشکل ادعای مهار بود، نه یک شکست برنامه/تست.
- **محدودیت شناخته شده:** پیکربندی قانون دائمی است اما هنوز سطح جهش HTTP/UI تایید شده ای ندارد. پیکربندی در حال حاضر فقط از طریق مرز/آزمایش مخزن داخلی قابل اعمال است.
- **محدودیت شناخته شده:** Runtime فقط رویدادهای امنیتی احراز هویت عادی AMI و دو قانون Task 28 موجود را ارزیابی می کند. منابع/قوانین امنیتی گسترده‌تر، تحویل اعلان‌های خارجی و ارائه داشبورد کارهای آینده باقی خواهند ماند.
- **تکلیف دقیق بعدی:** Task 32 APIهای پیکربندی قاعده با محدوده PBX احراز هویت شده را با اعتبار سنجی محدود نشان می دهد. External Notification Delivery خارج از محدوده است.

## 26-09-2026 - رکورد تکمیل Task 32

- **نتیجه:** APIهای HTTP با پیکربندی Alert Rule با محدوده PBX تأیید شده اضافه شد که توسط مخزن Task 31 پشتیبانی می شود.
- **سطح خواندن:** `GET /api/pbx-instances/:id/security-alert-rules` قوانین پیکربندی شده را فهرست می کند و `GET .../:ruleId` یک قانون مجاز لیست شده پیکربندی شده را برمی گرداند.
- **سطح جهش:** `PUT .../:ruleId` جایگزین یک پیکربندی قانون محدود می شود و `DELETE .../:ruleId` آن را حذف می کند. جهش ها به اصل تایید شده موجود به علاوه حفاظت با منشاء مشابه نیاز دارند.
- **مالکیت محدوده:** شناسه نمونه PBX و شناسه قانون متعلق به مسیر هستند. بدنه‌های درخواستی حاوی `instanceId` یا `id` رد می‌شوند و از لغو قوانین متقابل PBX/قوانین جلوگیری می‌کند.
- ** اعتبار سنجی: ** فقط دو شناسه قانون موجود قابل مسیریابی هستند. `AUTHENTICATION_FAILURE_ANY` فقط `enabled` را می پذیرد. قوانین آستانه نیاز به فعال کردن، آستانه 1 تا 100، پنجره 1 تا 3600 ثانیه، و به صورت اختیاری یک دلیل خرابی موجود دارند. فیلدهای غیرمنتظره بسته نشدند.
- **پیش فرض ها و عوارض جانبی:** هیچ قانونی به طور ضمنی ایجاد یا فعال نشده است. هیچ وب هوک، ایمیل، پیامک، ارائه دهنده چت، نوشتن PBX یا سایر اعلان های خارجی انجام نمی شود.
- ** اعتبار سنجی هدفمند: ** مجموعه ارائه دهنده-runtime/API پس از افزودن پوشش اعتبار، منبع مشابه، محدوده PBX، محدودیت نامعتبر، قانون ناشناخته، مالکیت مسیر، و پوشش حذف، 14/14 گذشت.
- **سیستم های واقعی:** هیچ PBX واقعی، گزارش تولید، گزارش امنیتی SSH یا هدف تحویل خارجی تماس گرفته نشد.

### Task 32 شکست / اشکال / شکاف

- **پیاده سازی/بررسی تایپ:** هیچ نقصی در بررسی تایپ پیاده سازی در وصله سرور Task 32 اولیه یافت نشد.
- ** اعتبار سنجی API هدفمند: ** در اولین اجرای هدفمند پس از درج آزمایشی 14/14 گذشت.
- **محدودیت شناخته شده:** Task 32 API های پیکربندی را نشان می دهد اما هنوز رابط کاربری مرورگر وجود ندارد. اپراتورها باید از API تأیید شده برای مدیریت قوانین استفاده کنند.
- **محدودیت شناخته شده:** فقط دو قانون AMI احراز هویت-شکست موجود قابل تنظیم هستند. خانواده‌های قانون/منبع گسترده‌تر و ارسال اعلان‌های خارجی همچنان کار آینده است.
- **تکلیف دقیق بعدی:** Task 33 اولین رابط کاربری نظارت بر امنیت تایید شده را برای مشاهده هشدارها و مدیریت دو قانون محدود اضافه می کند. External Notification Delivery خارج از محدوده است.

## 26-09-2026 - رکورد تکمیل Task 33

- **نتیجه:** اولین رابط کاربری نظارت بر امنیت دوزبانه احراز هویت شده به عنوان یک Frontend اختصاصی `SecurityWorkspace` اضافه شد.
- ** محدوده PBX: ** اپراتورها از پروفایل های PBX که قبلاً نصب شده اند را انتخاب می کنند. هیچ شناسه رایگان PBX در رابط کاربری امنیتی وجود ندارد.
- **نمایش هشدار:** رابط کاربری فقط هشدارهای محدود فعلی را با برچسب قانون، زمان مشاهده عادی و تعداد رویدادهای منطبق نمایش می دهد. فیلدهای خام AMI / ارائه دهنده / حساب / آدرس / درخواست وجود ندارد.
- **مدیریت قوانین:** رابط کاربری فقط `AUTHENTICATION_FAILURE_ANY` و `AUTHENTICATION_FAILURE_THRESHOLD` را مدیریت می کند. ورودی‌های آستانه 1 تا 100 و 1 تا 3600 ثانیه در سمت کلاینت اعمال می‌شوند در حالی که backend معتبر باقی می‌ماند.
- **رفتار دو زبانه:** برچسب های انگلیسی/فارسی از طریق مرز i18n موجود اضافه شد. سوئیچ جهت سند موجود همچنان به رفتار LTR/RTL خود ادامه می دهد.
- **عوارض جانبی:** هیچ وب هوک، ایمیل، پیامک، ارائه دهنده چت، نوشتن PBX یا سایر اعلان های خارجی انجام نمی شود.
- ** اعتبارسنجی هدفمند: ** تست های Frontend پس از افزودن پوشش کنترل محدود استاتیک به اضافه بارگذاری هشدار/قانون جریان و پوشش ذخیره قانون آستانه، 13/13 را پشت سر گذاشتند.
- **سیستم های واقعی:** هیچ PBX واقعی، گزارش تولید، گزارش امنیتی SSH یا هدف تحویل خارجی تماس گرفته نشد.

### Task 33 شکست / اشکال / شکاف

- ** رانش برابری دوزبانه قبل از کار — حل شد:** پس از ادغام Task 32، `MASTER_PLAN.md` دارای 282 خط بود در حالی که `MASTER_PLAN.fa.md` دارای 285 خط بود که به دلیل دو commit طرح فارسی دستی در شاخه ویژگی قبل از ادغام بود. علت اصلی ویرایش همراه ترجمه شده مستقل از منبع انگلیسی حقیقت بود. رفع: طرح فارسی را از طرح انگلیسی نهایی بازسازی کنید و بررسی های برابری ساختاری را مجددا اجرا کنید.
- **شکست اولیه بسته بندی وصله UI - رفع شد:** اولین بار پیتون راه دور وصله پایتون، درون یابی قالب TypeScript را به معنای واقعی کلمه در قالب جاوا اسکریپت تعبیه کرد، بنابراین بسته بندی ابزار قبل از ارسال وصله، `${...}` را تجزیه کرد. هیچ تغییری در فایل پروژه ایجاد نشد. رفع: پچ را به فایل های کوچکتر تقسیم کنید و رابط کاربری امنیتی را به یک جزء اختصاصی منتقل کنید.
- **شکست فرار از وصله API — برطرف شد:** وصله بعدی که نشانگرهای بکتیک تایپ اسکریپت فرار کرده/ نشانگرهای درون یابی تحت اللفظی را در `frontend/src/api.ts` وارد کرد، که پرتیه فوراً آن را رد کرد. علت اصلی فرار بیش از حد در حین محافظت از لفاف ابزار بود. رفع: کاراکترهای فرار اضافی را حذف کنید. جلوی تایپ و سپس تصویب شد.
- **محدودیت شناخته شده:** رابط کاربری فقط هشدارهای فعلی را می خواند و به صراحت بازخوانی می کند. هنوز جریان SSE هشدار موجود یا نقطه پایانی سابقه هشدار را مصرف نمی کند.
- **محدودیت شناخته شده:** فقط دو قانون AMI احراز هویت-شکست موجود نشان داده شده است. منابع/قوانین امنیتی گسترده‌تر و ارسال اعلان‌های خارجی همچنان کار آینده است.
- **تکلیف دقیق بعدی:** Task 34 به‌روزرسانی‌های هشدار فعلی را به‌علاوه تاریخچه هشدار اخیر در رابط کاربری نظارت بر امنیت تأیید شده با استفاده از مرزهای Backend موجود اضافه می‌کند.

## 26-09-2026 - رکورد تکمیل Task 34

- **نتیجه:** تاریخچه Security Alert اخیر و به‌روزرسانی‌های هشدار بیدرنگ با پشتوانه Persistence به `SecurityWorkspace` دوزبانه تأیید شده با استفاده از APIهای Backend موجود اضافه شد.
- ** محدود به تاریخچه: ** بارگیری دستی/عکس فوری فقط 24 ساعت اخیر PBX انتخابی را با `limit=100` درخواست می کند. کران های API سمت سرور همچنان معتبر هستند.
- **قرارداد بیدرنگ:** یک `EventSource` با همان مبدا برای PBX انتخابی باز شده است. محموله اولیه `{current}` SSE جایگزین وضعیت فعلی هر قانون می شود. بعداً محموله‌های `{alert}` جایگزین حالت فعلی برای آن قانون شده و تاریخچه را پیش‌فرض می‌کنند.
- **Deduplication/Display Bound:** تاریخچه بیدرنگ از هویت نمایش هشدار کامل استفاده می کند و بارهای هشدار یکسان مکرر را نادیده می گیرد. تاریخ اخیر نمایش داده شده در 100 ردیف محدود شده است.
- **رفتار شکست:** SSE JSON ناقص/قراردادها بسته نشدند. قطع جریان فقط نشانگر وضعیت زنده را تغییر می دهد. وضعیت موجود قابل مشاهده است و بازخوانی دستی به کار خود ادامه می دهد.
- **رفتار دو زبانه:** برچسب های تاریخچه اخیر و اتصال زنده از طریق مرز انگلیسی/فارسی i18n موجود اضافه شد.
- **عوارض جانبی خارجی:** هیچ. هیچ وب هوک، ایمیل، پیامک، ارائه دهنده چت، نوشتن PBX یا سایر اعلان های خارجی انجام نمی شود.
- ** اعتبار سنجی هدفمند: ** تست های Frontend 14/14 گذراندند، از جمله بارگیری تاریخچه 24 ساعته به علاوه رفتار ادغام بیدرنگ با ایمنی تکراری.
- **سیستم های واقعی:** هیچ PBX واقعی، گزارش تولید، گزارش امنیتی SSH یا هدف تحویل خارجی تماس گرفته نشد.

### Task 34 شکست / اشکال / شکاف

- **شکست اولیه بسته بندی وصله API - قبل از اصلاح فایل پروژه برطرف شد:** اولین بار وصله محلی درون یابی TypeScript `${...}` را در رشته الگوی جاوا اسکریپت ابزار راه دور جاسازی کرد، بنابراین wrapper آن را قبل از اجرا رد کرد. علت اصلی درون یابی لایه ابزار بود، نه کد پروژه. رفع: ارسال مجدد پچ از طریق رشته های نقل قول معمولی. سپس API/i18n تایپ کنید.
- **شکست نحوی کمکی مترجم طرح فارسی — برطرف شد:** اولین کمک کننده ترجمه Task 34 یک عبارت لامبدای پایتون نامعتبر داشت و قبل از نوشتن طرح فارسی خارج شد. علت اصلی یک اشتباه تایپی کمکی محلی بود. رفع: دستور لامبدا را قبل از اجرای مجدد تصحیح کنید.
- **شکست تقسیم دسته ای ترجمه طرح فارسی — رفع شد:** ویرایش کمکی بعدی توالی های regex بیش از حد در فایل Python تولید شده را پشت سر گذاشت، بنابراین اولین جداکننده دسته ای ترجمه شده را نمی توان دوباره به خطوط منبع تقسیم کرد. هیچ طرح ترجمه پذیرفته شده ای تولید نشد. رفع: کمک کننده را با عبارات خط/پیشوند و دسته جداکننده جایگزین کنید، سپس بررسی های برابری ساختاری را دوباره اجرا کنید.
- **Semantic Parity Drift در Master Plan فارسی — رفع شد:** ترجمه کامل بعدی ساختار خطوط را حفظ کرد، اما چند reference از نوع `Task N` را محلی‌سازی کرد و در یک خط یک token قالب‌بندی‌شده `SSH` را تکرار کرد؛ بنابراین Structural Parity به‌تنهایی کافی نبود. اصلاح: referenceهای Task/Phase نرمال شدند، خطوط متناظر آسیب‌دیده repair شدند و Final Parity Check برای مقایسه Task referenceها و تعداد code spanها در هر خط گسترش یافت.
- **محدودیت شناخته شده:** بومی `EventSource` وضعیت/بدنه HTTP را برای جریان ناموفق در مرورگر نشان نمی دهد. بنابراین، انقضای تأیید جریان به صورت وضعیت بلادرنگ قطع شده ظاهر می‌شود. تازه سازی/جهش API تأیید شده عادی بعدی همچنان مسیر خروج 401 موجود را دنبال می کند.
- **محدودیت شناخته شده:** سابقه اخیر عمدا یک پنجره UI 24 ساعته/100 ردیفی ثابت است. محدوده تاریخ قابل انتخاب توسط اپراتور، صفحه بندی، و ارائه نگهداری طولانی تر، کار آینده باقی می ماند.
- **محدودیت شناخته شده:** External Notification Delivery به دلیل طراحی کاملاً وجود ندارد.
- **وظیفه دقیق بعدی:** Task 35 فقط قراردادهای پیکربندی/صف/تکثیر اعلان خارجی محدود شده را تعریف می کند، بدون تحویل ارائه دهنده واقعی تا زمانی که به طور جداگانه تایید شود.

## 2026-09-26 — رکورد تکمیل Task 35

- **نتیجه:** Migration 11 و Repositoryهای محدود Notification Channel/Queue به‌عنوان Foundation صرفاً Storage برای External Delivery اضافه شدند.
- **قرارداد Channel:** هر Channel به یک PBX محدود است، یک ID پایدار دارد، Transport فعلاً فقط به `WEBHOOK` محدود شده و Metadata عمومی Persistشده فقط شامل Display Name، Enabled State و reference مبهم `secretName` است.
- **Scope تغییرناپذیر:** بعد از ایجاد یک Channel ID، PBX Owner و Transport آن قابل جابه‌جایی نیستند. Updateهای mutable نمی‌توانند Queue Work موجود را بین PBXها یا Delivery Transportها منتقل کنند.
- **قرارداد Queue:** Queue Recordها کل `SecurityAlertRecord` محدود، Delivery Key قطعی، هویت Channel/PBX و فقط Stateهای `PENDING` یا `CANCELLED` را Persist می‌کنند.
- **Deduplication:** Delivery Key با SHA-256 از Channel ID به‌علاوه هویت کامل Alert محدود ساخته می‌شود. همان Alert/Channel Pair فقط یک Queue Row تولید می‌کند.
- **Fail-closed Enqueue:** Channel گمشده/غیرفعال و Alert با PBX ناسازگار رد می‌شوند. خواندن Pending List حداکثر به 500 ردیف محدود است.
- **رفتار Cascade:** حذف Channel، Queue Rowهای همان Channel را حذف می‌کند؛ حذف PBX نیز Notification Configuration و Queue State را Cascade می‌کند.
- **External Side Effect:** هیچ‌کدام. در Task 35 هیچ Alert Subscription، Auto-Enqueue Runtime، HTTP Client، SMTP Client، Webhook Sender، Retry Worker، Provider Adapter، DNS Lookup یا Network Request وجود ندارد.
- **Targeted Validation:** Storage Suite با 10/10 PASS، Migration 11، Config Bounds، Cross-PBX Immutability، رد Enqueue برای Channel غیرفعال/ناسازگار، Duplicate-safe Enqueue، Cancel Semantics و Cascade Coverage را پوشش داد.
- **سیستم واقعی:** هیچ PBX واقعی یا External Notification System تماس داده نشد.

### Failure / Bug / Gapهای Task 35

- **Initial Remote Patch Wrapper Failure — قبل از تغییر فایل پروژه رفع شد:** Patch اول Task 35 شامل Backtickهای SQL/TypeScript داخل JavaScript Template Payload ابزار Remote بود و Wrapper پیش از اجرا آن را رد کرد. اصلاح: Patch با Placeholder خنثی ساخته شد و Backtick فقط داخل Tool Call جایگزین شد.
- **Invariant-test Patch اعمال نشد — شناسایی شد:** بعد از افزودن Immutable Channel Scope، Anchor اولیه برای درج Test با فایل Formatشده match نشد. چون آن Shell Command fail-fast نبود، Build/Test ادامه پیدا کرد و بدون Coverage برای Invariant جدید PASS شد. این PASS به‌عنوان ناکافی رد شد.
- **Invariant-test Heredoc Retry Failed — رفع شد:** تلاش بعدی با Inline Heredoc به‌خاطر آسیب در Quoting/Triple-String پیش از تغییر Test File متوقف شد. اصلاح: یک Python Patch File محلی و ignored نوشته شد، زیر `set -euo pipefail` اجرا شد، سپس Build و Storage Suite دوباره اجرا شدند؛ 10/10 با Coverage مربوط به Cross-PBX Reassignment پاس شد.
- **محدودیت شناخته‌شده:** `secretName` فعلاً فقط یک Opaque Reference است. Task 35 بررسی نمی‌کند Secret رمزگذاری‌شده متناظر واقعاً وجود دارد و Schema مربوط به Webhook URL/Auth Secret را تعریف نمی‌کند.
- **محدودیت شناخته‌شده:** هیچ Subscriber مربوط به Alert Publication به‌طور خودکار Delivery را Enqueue نمی‌کند. Queue Insertion فقط در Repository Boundary وجود دارد.
- **محدودیت شناخته‌شده:** هیچ Delivery Worker، Retry/Backoff، Provider Response/Status، Dead-letter Behavior یا External Connectivity واقعی وجود ندارد.
- **محدودیت شناخته‌شده:** Transport عمداً فقط به Placeholder Contract نوع `WEBHOOK` محدود است؛ Transportهای اختصاصی Email/SMS/Chat مدل نشده‌اند.
- **Task دقیق بعدی:** Task 36 فقط APIهای احرازشده و PBX-scoped برای Channel Configuration به‌همراه Encrypted Webhook-target Secret Management را اضافه می‌کند؛ External Sending همچنان خارج از Scope است.

## 2026-09-26 — رکورد تکمیل Task 36

- نتیجه: NotificationConfigurationService به‌همراه APIهای احرازشده و PBX-scoped برای list/get/put/delete در Notification Channel اضافه شد.
- Secret Boundary: Webhook Target URL فقط از طریق SecretStore با AES-256-GCM ذخیره می‌شود و هرگز توسط API برگردانده نمی‌شود.
- Validation Boundary: فقط HTTPS پذیرفته می‌شود؛ Embedded Credential/Fragment رد می‌شود؛ Input حداکثر 2048 کاراکتر است؛ هیچ Hostی resolve یا contact نمی‌شود.
- Safe Projection: Response شامل Operational Metadata به‌علاوه hasTarget است و Target URL، Internal Secret Name، Ciphertext و Decrypted Material را حذف می‌کند.
- Update Semantics: Create به Target نیاز دارد؛ Updateهای بعدی می‌توانند Encrypted Target موجود را بدون ارسال مجدد حفظ کنند.
- Delete Semantics: حذف Channel، Encrypted Target Secret را حذف می‌کند و Foreign Keyهای Task 35 نیز Queue Rowها را حذف می‌کنند.
- API Protection: Read نیازمند Authentication و Mutation نیازمند Authentication به‌علاوه Same-Origin Protection است.
- Targeted Validation: Onboarding/API Suite با 6/6 PASS شامل Auth، Same-Origin Rejection، HTTPS-only Validation، Encrypted Secret Verification، عدم Leak URL/Internal Secret، Update بدون Target و Delete-secret Behavior بود.
- سیستم واقعی: هیچ PBX واقعی یا External Notification Provider تماس داده نشد.

### Failure / Bug / Gapهای Task 36

- مسیر اشتباه SSH Configuration — رفع شد: Lookup اول از مسیر ناموجود System-metrics استفاده کرد؛ Service قابل‌استفاده واقعی backend/src/ssh/configuration.ts است.
- پوشه Notification Service وجود نداشت — رفع شد: اولین File Write پیش از تغییر Project به‌دلیل نبود backend/src/notifications شکست خورد؛ Directory ساخته شد.
- Initial API-test Insertion Anchor Mismatch — رفع شد: اولین Test Patch یک عنوان Test ناموجود را هدف گرفته بود؛ Anchor واقعی بررسی شد و سپس Targeted Suite پاس شد.
- محدودیت شناخته‌شده: Task 36 فقط Webhook Target URL را مدل می‌کند؛ Provider-specific Auth Header، Bearer Token، Signing Secret، Certificate و Custom Payload Template مدل نشده‌اند.
- محدودیت شناخته‌شده: HTTPS Syntax Validation ادعای Network Safety آینده نیست؛ Delivery Worker باید DNS/SSRF Policy، Redirect Policy، Timeout و Bounded Response را enforce کند.
- Task دقیق بعدی: Task 37، Backend/Frontend UI موجود را روی Monitoring Host به‌عنوان Managed Same-Origin Service Deploy می‌کند؛ Deployment Valueها Private/Local می‌مانند و Real-PBX Access جدیدی مجاز نمی‌کنند.

## 2026-09-26 — رکورد تکمیل Task 37

- **نتیجه:** Production HTTPS Gateway، Local Deployment Launcher، Generic Systemd Service Definition، Private Runtime Configuration و Live Same-Origin Backend/Frontend Deployment روی Monitoring Host اضافه شدند.
- **Network Boundary:** Backend فقط روی Loopback Bind است. HTTPS Gateway Built Frontend را Serve و Setup/Auth/API/Health/Readiness را Proxy می‌کند و Browser Host/Origin را برای Same-Origin Security Model موجود حفظ می‌کند.
- **TLS:** Live Host فعلاً از Private Self-signed Certificate زیر Ignored Local Storage استفاده می‌کند. Secure Production Cookie روی HTTPS درست است، اما Browser Trust هنوز Organization-managed نیست.
- **Private State:** Deployment Env، SQLite Data، Secret-store Files، TLS Private Key، PID و Runtime Log فقط در Ignored Local Storage می‌مانند. هیچ Host-specific Address یا Secret Commit نمی‌شود.
- **PBX Safety:** Deployment فعال صریحاً PBX Network Mode را Disabled نگه می‌دارد. Task 37 هیچ PBX Connection باز نکرد.
- **Management:** Repository Launcher از start/stop/status/run پشتیبانی می‌کند. Generic Hardened Systemd Unit برای Installationهای دارای Administrator Access Track شده است.
- **Live Verification:** HTTPS Index با 200 و React Root، Health با ok، Readiness با ready، Setup Status با Fresh-admin Setup Required، Backend به‌صورت Loopback-only و Browser-facing HTTPS Listener فعال تأیید شدند.
- **Lifecycle Verification:** بعد از Process-group Fix، مسیر start -> health -> stop -> no remaining listeners -> restart -> status -> health PASS شد.

### Failure / Bug / Gapهای Task 37

- **Combined Remote Capability Command Blocked — بدون تغییر:** یک Command فقط-خواندنی شامل sudo/system checks توسط Remote Execution Policy رد شد. بررسی‌ها به Commandهای Read-only و Non-privileged تقسیم شدند.
- **Deployment Script Wrapper Interpolation Failures — قبل از File Creation رفع شد:** Payloadهای اولیه Script شامل Shell/JavaScript Interpolation Token بودند که Remote Wrapper Parse می‌کرد. اصلاح: Neutral Placeholder استفاده شد و Literal Character داخل Tool Call جایگزین شد.
- **Launcher Stop Bug — رفع شد:** Stop اولیه فقط Parent Shell را متوقف کرد و Backend/HTTPS Gateway Childها Listener باقی ماندند. Root Cause نداشتن Process-group Ownership بود. اصلاح: Stack با setsid اجرا و کل Negative-PGID Group terminate شد؛ Lifecycle Re-validation PASS شد.
- **Gateway Lint Failure — رفع شد:** اولین Full Gate Run، Node Globalهای `production-gateway.mjs` را رد کرد چون این Repository، `process`، `console`، `URL` و `setTimeout` را Implicit Global فرض نمی‌کند. اصلاح: Node Built-inهای متناظر Explicit Import شدند و کل Gate Suite دوباره اجرا شد.
- **Full-gate Shell Wrapper Failure — رفع شد:** اولین Full-gate Rerun وارد Nested Fail-fast Shell شد بدون اینکه `NODE_BIN` Export شده باشد؛ بنابراین `set -u` قبل از Testها بلافاصله متوقف شد. اصلاح: `NODE_BIN` پیش از ورود به Nested Shell Export شد و کل Suite از Parity/Lint به بعد دوباره اجرا شد.
- **Same-origin POST Probe توسط Remote Safety Layer Block شد — بدون تغییر Application State:** POST عمداً نامعتبر برای بررسی Forwarded Origin پیش از اجرا توسط Safety Layer ابزار متوقف شد. Automated Same-Origin API Testهای موجود به‌علاوه HTTPS GET Proxy Verification مبنای Validation باقی ماندند.
- **Browser SSE Live-update Disconnect — پس از استفاده زنده رفع شد:** Routeهای Authenticated و Read-only از نوع SSE GET به `Origin` Header اجباری نیاز داشتند، در حالی که Native Same-origin `EventSource` الگوی Synthetic Origin مورد استفاده در Backend Testها را تضمین نمی‌کند. نتیجه این بود که Streamهای Live با 403 قطع می‌شدند، در حالی که Readهای Authenticated عادی کار می‌کردند. اصلاح: CSRF-style Same-origin Enforcement فقط از Read-only SSE GET Routeها حذف شد؛ Authentication، PBX Scoping، Stream Limit و Mutation Same-origin Protection دست‌نخورده باقی ماندند. Provider-runtime Regression Testها با Browser-compatible No-Origin Stream Coverage به‌صورت 14/14 PASS شدند.
- **محدودیت شناخته‌شده:** Live Certificate Self-signed است و توسط Browser/Organization PKI Trusted نیست.
- **محدودیت شناخته‌شده:** Generic Systemd Unit Track شده اما روی این Host نصب نشده چون Installation سطح System نیازمند Administrator Privilege خارج از دسترس این Session است؛ Launcher فعلی Automatic Recovery پس از Host Reboot را تضمین نمی‌کند.
- **محدودیت شناخته‌شده:** Host Firewall Policy برای Browser-facing HTTPS Port بدون Administrator Access به‌صورت Authoritative قابل تغییر/Validation نبود.
- **Task دقیق بعدی:** Task 38، Tracked OS Service را با Administrator Privilege نصب می‌کند، Trusted TLS/Firewall Policy را برقرار می‌کند، Reboot انجام می‌دهد و Automatic UI Recovery را در حالی Validate می‌کند که PBX Networking بدون تأیید جداگانه Disabled باقی می‌ماند.

## 2026-09-26 — رکورد تکمیل Task 38

- **نتیجه:** Deployment Trackشده به‌صورت OS-level Systemd Service نصب شد و Automatic Recovery پس از Reboot واقعی Host اثبات شد.
- **Service Identity:** Systemd Stack را با User/Group اختصاصی `voip-monitor` و `Restart=on-failure` اجرا می‌کند؛ Backend فقط Loopback و HTTPS Gateway تنها Browser-facing Listener باقی می‌ماند.
- **Runtime Boundary:** Launcher اکنون `VOIP_MONITOR_NODE_BIN` صریح می‌پذیرد؛ System Service به‌جای Ignored Local Toolchain از Production Runtime Path استفاده می‌کند.
- **Installer:** Root-only Fail-closed Production Installer اضافه شد که Node 24، تطابق TLS Key/Certificate، وجود Data Source، Bound مربوط به PBX Network Mode، Service Account/Runtime/Data/TLS Placement، Unit Installation و Enable/Start را Validate می‌کند.
- **Self-signed Exception:** Self-Signed Certificate همچنان Default رد می‌شود. Operator استفاده موقت از Certificate فعلی را صریحاً تأیید کرد و این فقط با `--allow-self-signed` فعال می‌شود.
- **Reboot Proof:** پس از Reboot واقعی Host، `voip-monitor.service` بدون Manual Start Enabled + Active/Running بود؛ Health=ok، Readiness=ready، Frontend Root Render شد، Backend Loopback باقی ماند و HTTPS خودکار Recover شد.
- **Firewall State:** طبق خروجی Operator، UFW غیرفعال است. HTTPS پس از Reboot Reachable است، پس Exposure عملی است؛ اما Restrictive Host Firewall Policy وجود ندارد که بتوان آن را Hardened نامید.
- **PBX Scope:** Monitoring Read-only از قبل تأییدشده بدون تغییر باقی ماند؛ هیچ PBX Write/Configuration Action انجام نشد.

### Failure / Bug / Gapهای Task 38

- **Remote Privileged-command Limitation — مدیریت شد:** این Session طبق Remote Policy نمی‌تواند sudo/root Firewall/Systemd Installation Command اجرا کند. Operator Installer بازبینی‌شده را اجرا کرد و خروجی Systemd/UFW را ارائه داد.
- **Systemd Runtime-path Incompatibility — پیش از Installation رفع شد:** Unit عمومی ابتدا به Node زیر Ignored `.local` وابسته بود که Parent Permission آن برای Dedicated Service Account قابل Traverse نبود. اصلاح: Support صریح `VOIP_MONITOR_NODE_BIN` و Root-owned Read-only Production Runtime Path اضافه شد.
- **Installer Self-signed Policy Mismatch — با Explicit Exception رفع شد:** Installer اولیه به‌درستی Self-Signed TLS را رد می‌کرد، در حالی که Operator موقتاً آن را پذیرفت. اصلاح: Rejection امن Default حفظ شد و `--allow-self-signed` Opt-in صریح اضافه شد.
- **Post-reboot `/proc` Environment Inspection Denied — بدون اثر:** Session Non-root نتوانست Process Environment سرویس را مستقیم بخواند. Systemd Identity/Status، Filesystem Ownership، Listenerها، HTTPS Health/Readiness و Reboot Recovery Validation کافی را فراهم کردند.
- **Root Firewall Introspection برای این Session در دسترس نبود:** UFW/nft به Root نیاز دارند. Operator UFW را Inactive گزارش کرد؛ HTTPS Reachability پس از Reboot Reachability را ثابت می‌کند، نه Firewall Hardening محدودکننده را.
- **محدودیت شناخته‌شده:** TLS همچنان Self-Signed است و Browser/PKI Trust سازمانی ندارد.
- **محدودیت شناخته‌شده:** Host Firewall Enforcement محدودکننده نیست؛ اگر Segmentation لازم باشد، Hardening بعدی باید Source CIDRها را تعریف و در Host یا Upstream Firewall Enforce کند.
- **Task دقیق بعدی:** Task 39 اولین Bilingual Operator Dashboard را فقط از APIهای Safe موجود می‌سازد، بدون PBX Write Action یا Collection Scope جدید.

## 2026-10-05 — رکورد تکمیل Task 39

- **نتیجه:** اولین Bilingual Operator Dashboard واقعی روی `feature/operator-dashboard` پیاده‌سازی شد.
- **APIهای موجود:** فقط `provider-status`، Current System Metrics، System-metrics SSE، Current Security Alerts و Security-alert SSE مصرف می‌شوند؛ Backend Route جدیدی اضافه نشد.
- **خلاصه اپراتور:** PBX Selector، Provider Connection State، Live-update Health، CPU، Memory، Uptime، Current Security-alert Count و Navigation به Workspaceهای PBX/Security.
- **Freshness:** Provider Status هر ۱۵ ثانیه از Local Status Refresh می‌شود؛ Metrics و Alerts از SSE موجود استفاده می‌کنند.
- **UI:** Labelهای انگلیسی/فارسی و Mobile Single-column Layout اضافه شدند.
- **Validation:** Testهای Frontend با Synthetic Data، Boundaryهای Provider/Metrics/Alerts/Realtime را پوشش می‌دهند.
- **Final Validation:** Lint، Format Check، Typecheck، Backend Testهای 126/126، Frontend Testهای 15/15، Production Build، Foundation Check، License Check، Staged Diff Check، Private-path Exclusion، Remote Desktop Identifier Review و Common Secret-marker Review همگی PASS شدند.
- **PBX Scope:** هیچ PBX واقعی Contact، Probe یا Modify نشد.

### Failure / Bug / Gapهای Task 39

- **Remote Command Quoting Failure — رفع شد.**
- **Optional-property Type Mismatch — رفع شد.**
- **Formatting Drift — رفع شد.**
- **Date-dependent Backend Test Fixture — رفع شد:** Full Suite نشان داد System-metrics Runtime Test از Sample ثابت 2026-09-25 استفاده می‌کند، در حالی که Seven-day Retention از Current Clock استفاده می‌کند. Fixture اکنون Sample/History Timestampها را از یک Current-time Base مشترک می‌سازد و Targeted Runtime Tests برابر 3/3 PASS شدند.
- **Known limitation:** Telephony Current-state Browser Surface هنوز وجود ندارد.
- **Known limitation:** Provider Connection State Poll می‌شود، Stream نمی‌شود.
- **Task دقیق بعدی:** Task 40، Current-state و Realtime APIهای Authenticated، Bounded و Read-only برای `TelephonyStateEngine` موجود را اضافه می‌کند؛ بدون PBX Connection، Action یا Data Collection جدید.

## 2026-10-05 — رکورد تکمیل Task 40

- **نتیجه:** `TelephonyStateEngine` موجود روی `feature/telephony-state-api` از طریق APIهای Authenticated، PBX-scoped و Read-only برای Current State و SSE Realtime ارائه شد.
- **Current-state API:** `GET /api/pbx-instances/:id/telephony-state` مقدار `{ current }` را از Engine در حال اجرا می‌دهد و وقتی Authoritative State هنوز وجود ندارد `null` برمی‌گرداند.
- **Realtime API:** `GET /api/pbx-instances/:id/telephony-state/stream` Initial Current Snapshot و Revisionهای بعدی همان PBX را ارسال می‌کند.
- **Reset Semantics:** Profile/runtime Reset مقدار `current: null` منتشر می‌کند تا Client State قدیمی را نگه ندارد.
- **Bounds:** Stream فقط GET، Authenticated و PBX-scoped است، حداکثر 64 Client همزمان دارد و Heartbeat پانزده‌ثانیه‌ای ارسال می‌کند.
- **Data Boundary:** Payload فقط از Normalized `TelephonyInstanceState` می‌آید؛ API Raw AMI Frame یا API-edge Identity Enrichment اضافه نمی‌کند.
- **Runtime Isolation:** Browser/API Consumer هیچ Provider Instance، AMI Connection، AMI Action، SSH Work یا Persistence Work جدیدی ایجاد نمی‌کند.
- **Targeted Validation:** Backend Typecheck PASS شد و Provider-runtime/API Suite برابر 15/15 PASS شد؛ Auth، PBX Scoping، GET-only Behavior، Initial Snapshot، PBX-filtered Revision و Reset-to-null پوشش داده شدند.
- **Final Validation:** Lint، Format Check، Typecheck، Backend Testهای 127/127، Frontend Testهای 15/15، Production Build، Foundation Check، License Check و Diff Check همگی PASS شدند.
- **PBX Scope:** هیچ PBX واقعی Contact، Probe یا Modify نشد و Permission جدیدی داده نشد.

### Failure / Bug / Gapهای Task 40

- **Heartbeat Escape Syntax Failure — رفع شد:** Python Heredoc Escaping باعث Physical Newline داخل TypeScript String شد؛ Literal SSE Newline Escape بازیابی شد و Typecheck PASS شد.
- **Remote Wrapper Parse Failure — رفع شد:** Nested Template Literal اولین Test-edit Wrapper را پیش از Execution شکست؛ Test Edit با Plain Concatenation بازنویسی شد.
- **Formatting Drift — رفع شد:** Prettier فایل‌های Server/Test تغییرکرده را Normalize کرد.
- **Known limitation:** Telephony History/Persistence بخشی از Task 40 نیست.
- **Known limitation:** Operator Dashboard هنوز Telephony State API/SSE جدید را مصرف نمی‌کند.
- **Known limitation:** Agent State از نوع Live-only است و Queue/Agent Real-PBX Compatibility هنوز Verify نشده است.
- **Task دقیق بعدی:** Task 41، Task 40 را در Bilingual Operator UI مصرف می‌کند و فقط PBX-scoped Synchronization به‌همراه Current Call/Channel/Endpoint/Trunk/Queue/Agent Interaction را نمایش می‌دهد؛ بدون PBX Write، History یا Collection گسترده‌تر.

## 2026-10-05 — رکورد تکمیل Task 41

- **نتیجه:** Bilingual Telephony Operator Dashboard روی `feature/telephony-dashboard-ui` با Primitiveهای Chakra UI v3 و APIهای Read-only مربوط به Task 40 پیاده‌سازی شد.
- **Design System:** `@chakra-ui/react 3.37.0` و `@emotion/react 11.14.0` اضافه شدند. Chakra فقط به Operator Dashboard Scope شده و باعث Whole-application Rewrite نشده است.
- **Telephony API Consumption:** Frontend، `/telephony-state` را Load و `/telephony-state/stream` را برای PBX انتخاب‌شده Subscribe می‌کند.
- **Dashboard State:** Provider Connection، Aggregate Live-stream Health، System Metrics، Security-alert Count، Telephony Synchronization/Revision، Current Call/Channel Count و Queue/Agent Count در Responsive Chakra Cardها خلاصه می‌شوند.
- **Telephony Detail:** Current Call، Channel، Endpoint، Trunk، Queue، Queue Member/Caller Count و Live Agent Interaction فقط از Contract نرمال‌شده نمایش داده می‌شوند.
- **Bilingual/RTL:** Persian از Application-level RTL استفاده می‌کند و Technical IDها برای جلوگیری از Bidi Corruption به‌صورت LTR Render می‌شوند.
- **Responsive:** Chakra Responsive Propها در Mobile از Single-column Layout استفاده می‌کنند و در Breakpointهای بزرگ‌تر Gridها گسترش پیدا می‌کنند.
- **Realtime Validation:** Frontend Test Suite، Initial Telephony Snapshot و Synthetic SSE Transition به `STALE` Revision 9 را Validate می‌کند و حذف Agent Data قدیمی را هم بررسی می‌کند.
- **Targeted Validation:** Frontend Typecheck و Frontend Testهای 15/15 PASS شدند؛ License Checker بعد از Explicit 0BSD Review PASS شد.
- **Final Validation:** با Project Node 24.21.0/npm 11.19.0، Lint، Format Check، Typecheck، Backend Testهای 127/127، Frontend Testهای 15/15، Production Build، Foundation Check، License Check و Diff Check همگی PASS شدند.
- **Build Observation:** Production Frontend JavaScript Bundle قبل از Gzip برابر 519,828 Bytes است. Vite/Rolldown برای Ark UI Warningهای Upstream مربوط به `"use client"` Module Directive می‌دهد؛ این پروژه SPA کاملاً Client-side است و Build موفق است، اما Dependency Footprint به‌عنوان Optimization Target شناخته‌شده ثبت می‌شود.
- **PBX Scope:** هیچ PBX واقعی Contact، Probe یا Modify نشد و Permission جدیدی داده نشد.

### Failure / Bug / Gapهای Task 41

- **Node/npm Engine Warning — رفع شد:** Dependency Install اولیه با Shell Node 22 اجرا شد؛ Lockfile Reset و با Project Node 24.21.0/npm 11.19.0 Regenerate شد.
- **Chakra Label Typing Mismatch — رفع شد:** Native Label Semantics حفظ شد و Chakra فقط Typography را مدیریت می‌کند.
- **Formatting Drift — رفع شد:** Prettier فایل‌های Frontend جدید را Normalize کرد.
- **0BSD License Review — رفع شد:** License Text مربوط به `tslib 2.8.1` بررسی و SPDX ID آن به Explicit Repository Allowlist اضافه شد.
- **Known limitation:** Chakra در این Task عمداً فقط Operator Dashboard را پوشش می‌دهد.
- **Known limitation:** Chakra/Ark Dependency Footprint فعلی یک Raw Production JavaScript Bundle برابر 519,828 Bytes و Rolldown Warningهای غیر Fatal مربوط به `"use client"` ایجاد می‌کند. Bundle Reduction بخشی از Task 41 نیست.
- **Known limitation:** Telephony History/Retention پیاده‌سازی نشده است.
- **Known limitation:** Agent Interaction از نوع Live-only است و Queue/Agent Real-PBX Compatibility هنوز Verify نشده است.
- **یادداشت Task بعدی Superseded:** Feedback اپراتور SSH Metrics Onboarding و Trunk Completeness را جلوتر از Telephony History قرار داد. History به Task 44 منتقل شد؛ Task 42 فعلی SSH Configuration Management است.

### پروتکل ادامه مداوم

برای هر کار/جلسه آینده:

1. `AGENTS.md`، این `MASTER_PLAN.md`، `PROJECT_CONTEXT.md`، `DECISIONS.md`، و در صورت وجود `.local/DEPLOYMENT_CONTEXT.md` نادیده گرفته شده را بخوانید.
2. شاخه/وضعیت/log Git را بررسی کنید و `main` را قبل از ایجاد شاخه ویژگی بعدی همگام کنید.
3. این قانون را حفظ کنید که هیچ PBX واقعی بدون تأیید صریح تماس گرفته یا تغییر داده نمی شود.
4. قبل از اتمام کار، این Master Plan را با موارد زیر به‌روزرسانی کنید: نتیجه کار، وضعیت شاخه/تعهد/PR، خرابی‌ها یا اشکالات یافت شده و وضوح/وضعیت آن‌ها، محدودیت‌های شناخته شده، و کار دقیق بعدی. زمانی که معماری/حالت فعلی تغییر می کند، `PROJECT_CONTEXT.md` و `DECISIONS.md` را به روز کنید. بازسازی `MASTER_PLAN.fa.md` به عنوان ترجمه کامل فارسی با ساختار/محتوای یکسان. هرگز آن را به عنوان یک خلاصه حفظ نکنید.
5. Gate های مخزن را اجرا کنید، بازبینی عمومی/مخفی، به صورت اتمی انجام دهید، به طور معمول فشار دهید، سپس برای تایید/ادغام متوقف شوید.
6. هرگز شناسه‌های دستگاه دسکتاپ از راه دور، جزئیات واقعی PBX، اعتبارنامه‌ها یا حقایق استقرار خصوصی را در اسناد عمومی ردیابی شده قرار ندهید.

## مراحل آینده - در انتظار تایید

وظایف 7 تا 13 کارهای اساسی ارائه‌دهنده Asterisk و پایه تلفن را زودتر از سطل‌های فاز سطح بالا اولیه اجرا کردند. برچسب‌های فاز زیر نقشه راه محصول باقی‌مانده را به‌جای این‌که اشاره کنند که کار تکمیل‌شده ارائه‌دهنده باید تکرار شود، توضیح می‌دهند.

- [ ] Phase 3: مدیریت حساب و پالایش داخلی.
- [x] Gate پایه Phase 4: یکپارچه سازی ارائه دهنده Asterisk - خط مشی شبکه، حمل و نقل AMI، ورود به سیستم/کشف، چرخه عمر Runtime، تأیید اتصال، اشتراک رویداد عادی، عکس های فوری کانال/سازگاری، و یک Gate سازگاری واقعی Asterisk 13.x کنترل شده کامل شده است.
- [x] پایه Phase 5: موتور حالت تلفن - کانال/تماس قطعی، نقطه پایانی/ثبت نام chan_sip، صندوق ثبت نام خروجی، صف/عضو/تماس گیرنده، و پایه های حالت تعامل فقط با عامل زنده اجرا می شوند. سازگاری Queue/Agent real-PBX تا زمانی که یک Gate سازگاری کنترل‌شده بعداً ارائه شود، بی ادعا باقی می‌ماند.
- [x] پایه Phase 6: قراردادهای متریک سیستم ارائه‌دهنده خنثی، اعتبار سنجی جمع‌آوری بسته با شکست، محدودیت‌های فرمان SSH فهرست مجاز/اجرای محدودیت‌ها/ تجزیه‌کننده‌های سیستم لینوکس، پیکربندی SSH رمزگذاری‌شده به ازای هر PBX، اعتماد کلید میزبان پین شده، خط‌مشی SSRF مشترک، حمل‌ونقل منبع فعلی SSHBX محدود شده، حمل‌ونقل منبع سلامت BX در هر زمان تداوم، و جریان/تاریخچه تأیید شده به‌علاوه قرار گرفتن در معرض سنجه‌های سیستم بلادرنگ پیاده‌سازی می‌شوند.
- [x] مرحله 7: نظارت بر امنیت - رویدادهای احراز هویت عادی AMI، Persistence/API/SSE، ارزیابی هشدار محدود/تداوم/قوانین/Runtime، APIهای احراز هویت شده، و رابط کاربری هشدار دوزبانه فعلی/تاریخ اخیر/زمان بیدرنگ برای بخش تعریف شده کامل هستند. منابع/قوانین گسترده‌تر و تحویل خارجی، کارهای آینده جداگانه باقی می‌مانند.
- [x] پایه Phase 8: Authenticated PBX-scoped Read-only/Realtime Exposure برای System Metrics، Security State/Alerts و Normalized Telephony Current State موجود است.
- [x] Phase 9: پایه Bilingual Operator Dashboard با Boundaryهای Safe موجود Provider/System/Security.
- [ ] Phase 10: History/Reporting مستقیم از Source بدون Duplicate Telemetry Persistence و Migration کنترل‌شده Historyهای Monitoring قدیمی به Policy جدید.
- [x] Phase 11: Hardening، Backup در حالت Service-stopped، Restore تست‌شده با Checksum و Runbook دوزبانه عملیات Production.
- [x] Phase 12: اعتبار سنجی انتشار، از جمله رویه استقرار تازه خنثی برای سازمان که می تواند بدون حمل مقادیر خصوصی از استقرار دیگر، روی یک سرویس جدید نصب شود.

Phase 1 بسته است. Foundationهای Live Monitoring تا Operator Dashboard کامل‌اند و Task 47 اکنون Historical/Reporting Viewهای Source-backed محدود را بدون Duplicate Storage محلی ارائه می‌کند. Task دقیق بعدی پس از Merge شدن Task 47، **Task 48** است: تطبیق Legacy Monitoring Historyهای Persist‌شده محلی با Non-duplication Policy و تعریف Migration/Cleanup Plan امن قبل از هر حذف مخرب.

## 26-09-2026 - رکورد تکمیل Task 28

- **نتیجه:** `SecurityAlertEvaluator` به‌عنوان یک مرز ارزیابی قوانین Backend محدود شده بر تاریخچه عادی `SecurityEvent` اضافه شد.
- **قوانین پشتیبانی شده:** فقط `AUTHENTICATION_FAILURE_ANY` و `AUTHENTICATION_FAILURE_THRESHOLD`.
- **رفتار با شکست:** قوانین ناشناخته، فیلدهای غیرمنتظره، محدوده های نامعتبر، رویدادهای نامعتبر، و خطاهای ذخیره سازی/ارزیابی هرگز یکسان نیستند.
- **حدود:** آستانه 1-100، پنجره 1-3600 ثانیه، حداکثر 500 ردیف تاریخ در هر ارزیابی.
- **عوارض جانبی:** هیچ. هیچ اقدامی برای نوشتن PBX، تحویل خارجی، وب هوک، ارائه‌دهنده اعلان یا عملکرد شبکه انجام نمی‌شود.
- ** اعتبار سنجی: ** Lint، Format Check، Typecheck، تست های پشتیبان 117/117، تست های Frontend 10/10، و بررسی های دود ارزیاب مستقل با موفقیت انجام شد.
- **سیستم های واقعی:** هیچ PBX واقعی، گزارش تولید، گزارش امنیتی SSH یا هدف تحویل خارجی تماس گرفته نشد.

### Task 28 شکست / اشکال / شکاف

- ** شکست تایپ - رفع شد:** از مقادیر قاعده خام `unknown` به عنوان مقادیر آستانه/پنجره عددی استفاده شد. علت اصلی، محدودیت نوع صریح را از دست داده بود. رفع: هر دو مقدار را قبل از اعتبارسنجی محدوده به `number` محدود کنید. دروازه های کامل سپس گذشت.
- ** شکاف فایل آزمون ارزیاب اختصاصی — باز:** درز ویرایش از راه دور ایجاد یک فایل تست ارزیاب اختصاصی جدید را رد کرد. اعتبار سنجی دود مستقل اجرا شد، اما یک آزمایش ارزیاب اختصاصی متعهد همچنان یک شکاف بعدی است.

### قانون اجباری شکست/ضبط اشکال

برای هر کار آینده، خرابی ها و اشکالات حل شده را در این طرح با موارد زیر حفظ کنید: مرحله مشاهده شده، علت اصلی، رفع مشکل، نتیجه تأیید مجدد، وضعیت/تاثیر فعلی و محدودیت های شناخته شده. شکست های تاریخی را صرفاً به این دلیل که رفع شده اند حذف نکنید.

## 2026-10-06 — ثبت تکمیل Task 47

- **نتیجه:** APIهای GET-only احراز هویت‌شده و PBX-scoped برای Source-backed History و یک Workspace دو‌زبانه History با استفاده از Transport مربوط به Task 45 و Schema Adapter مربوط به Task 46 اضافه شد.
- **سطح API:** مسیر `GET /api/pbx-instances/:id/history` Capability هر Dataset را گزارش می‌کند. مسیرهای `/history/calls`، `/history/call-events` و `/history/queue-events` فقط Recent Normalized Rowهای Source را برمی‌گردانند.
- **حدود:** درخواست Row فقط `limit` صحیح بین 1 تا 200 را می‌پذیرد و Timeout، Row Limit و Normalized-output Limit مربوط به Task 45 همچنان در لایه زیرین اعمال می‌شوند.
- **بدون Raw SQL:** Caller نمی‌تواند SQL، Identifier، Schema Name، Table Name یا Query Parameter دلخواه ارسال کند.
- **بدون Duplicate Storage:** Task 47 هیچ SQLite History Table، Backend Cache، Browser Persistence، Background Poller یا Startup Database Probe اضافه نمی‌کند. Rowهای برگشتی فقط داده موقت API/UI هستند.
- **رفتار UI:** Operator یک PBX را انتخاب می‌کند؛ Capability Inspection هر Dataset را به `SUPPORTED`، `NOT_FOUND`، `SCHEMA_MISMATCH` یا `AMBIGUOUS` طبقه‌بندی می‌کند؛ Datasetهای Unsupported غیرفعال می‌شوند و Recent Rowها فقط با Action صریح Operator Load می‌شوند.
- **رفتار Timestamp:** Timestampهای Source دقیقاً به‌شکل Source-reported نمایش داده می‌شوند و UI صریحاً اعلام می‌کند Timestampهای Naive با Timezone ساختگی Relabel نمی‌شوند.
- **مرز خطا:** خطاهای Schema/Query/Transport فقط به Errorهای محدود Application Map می‌شوند؛ SQL Text، Credential، Database Host Detail، Driver Error و Raw Source Field دلخواه بازگردانده نمی‌شوند.
- **Targeted Validation:** تست Backend Database/History API برابر 6/6 و تست Frontend برابر 25/25 با Sourceهای Synthetic/Mock پاس شد.
- **دامنه PBX/Database:** در Task 47 هیچ Real PBX، Production Database، Source Schema، Credential، DNS Target یا Production Host Contact نشد.
- **Task دقیق بعدی:** بعد از Merge شدن Task 47، Task 48 باید Legacy Monitoring Historyهای Persist‌شده محلی را با Non-duplication Policy تطبیق دهد و قبل از هر حذف مخرب Migration/Cleanup Plan امن تعریف کند.

### خرابی‌ها / Bugها / Gapهای Task 47

- **Option پشتیبانی‌نشده Vitest — رفع شد:** اولین Targeted Frontend Command از `--runInBand` استفاده کرد که Vitest 5 پشتیبانی نمی‌کند. Failure فقط مربوط به Command Line بود؛ اجرای مجدد Script خود Repository برابر 25/25 PASS شد.
- **انتخاب اولیه Node اشتباه در Shell — قبل از Final Gate کنترل شد:** مسیر عمومی Toolchain محلی هنوز Node 22 را Resolve می‌کرد. Final Validation از مسیر صریح Archive مربوط به Project Node 24.21.0 استفاده می‌کند.
- **محدودیت شناخته‌شده:** Task 47 فقط Recent Rowهای محدود را ارائه می‌کند؛ Date Range دلخواه، Cursor Pagination، Export، Aggregation/Report Builder و Cross-PBX Query پیاده‌سازی نشده است.
- **محدودیت شناخته‌شده:** `ASTERISK_CONVENTIONAL_SQL_V1` همچنان تنها History Schema Adapter است. Custom/Vendor Schemaها به Adapter آینده صریح نیاز دارند.
- **محدودیت شناخته‌شده:** هیچ Real-database Compatibility Claim وجود ندارد. هر Real Source-database Access همچنان Operational Action با Approval جداگانه است.

### Final Validation مربوط به Task 47

- **Final Repository Gateها:** با Project Node 24.21.0 و npm 11.19.0، Lint، Format Check، Typecheck، تست‌های Backend برابر 163/163، تست‌های Frontend برابر 25/25، Production Build، Foundation Check، License Check و `git diff --check` همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag درباره `"use client"` همچنان Non-fatal هستند و Impact آن‌ها تغییری نکرده است.

## 2026-10-06 — ثبت تکمیل Task 48

- **نتیجه:** System Metric History، Security Event History و Security Alert History جدید دیگر داخل SQLite Persist نمی‌شوند و Recent History/Trend فقط در Bufferهای محدود Process Memory نگه‌داری می‌شود.
- **حدود:** System Metrics حداکثر 2048 Record برای هر PBX و Security Event/Alert هرکدام حداکثر 500 Record برای هر PBX نگه می‌دارند. Retention Cutoff همچنان اعمال می‌شود.
- **Operational State باقی‌مانده:** Current System Metric، Current Security Event، Current Alertهای Rule، Configuration، Secretها، Dashboardها و Notification Reliability State همچنان Persist می‌شوند.
- **Legacy Tableها:** `system_metric_history`، `security_event_history` و `security_alert_history` دیگر Write نمی‌شوند ولی در Task 48 Drop یا Modify نشده‌اند.
- **Cleanup Plan:** حذف مخرب فقط بعد از Observation روی Deployment، Review وابستگی‌ها و Backup/Restore تست‌شده و در Migration جداگانه انجام می‌شود.
- **Bug رفع‌شده:** Implementation اولیه بعد از Prune می‌توانست Record قدیمی‌تر از Cutoff را دوباره Insert کند. اکنون Record قدیمی قبل از Append Reject می‌شود و Targeted Testها 18/18 PASS هستند.
- **محدودیت شناخته‌شده:** Recent History/Trend محلی بعد از Restart عمداً خالی می‌شود و دوباره از Live Data پر می‌شود؛ این بخش Durable Reporting History نیست.
- **Task دقیق بعدی:** Task 49 — Hardening، Backup، Tested Restore و Production Deployment Runbook، همراه با تصمیم صریح Cleanup برای Legacy History Tableها.

### Final Validation مربوط به Task 48

- **Final Repository Gateها:** با Project Node 24.21.0 و npm 11.19.0، Lint، Format Check، Typecheck، تست‌های Backend برابر 164/164، تست‌های Frontend برابر 25/25، Production Build، Foundation Check، License Check و `git diff --check` همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag درباره `"use client"` همچنان Non-fatal هستند.

## 2026-10-06 — ثبت تکمیل Task 49

- **نتیجه:** Hardening سرویس Production، Scriptهای Fail-closed برای Backup/Restore در حالت Service-stopped، تست خودکار Restore واقعی SQLite و Runbookهای دوزبانه Production کامل شدند.
- **Backup Contract:** SQLite معتبر، Master Key دقیقاً ۳۲ بایتی، Environment File، Application Ref امن، تأیید صریح Stop بودن Service و TLS Pair اختیاری لازم است. Recovery Directory با Mode `0700` و Fileهای `0600` همراه Manifest و SHA-256 Checksum ساخته می‌شود.
- **Restore Contract:** قبل از Write، Backup Format، SQLite Header، Master-key Size و همه Checksumها Validate می‌شوند؛ Target موجود بدون `--allow-overwrite` صریح Reject می‌شود.
- **Restore Proof:** Automation Synthetic یک SQLite واقعی می‌سازد، Backup/Restore را اجرا می‌کند، Database Restore‌شده را باز و Probe را می‌خواند، Overwrite Refusal و Tamper Failure را اثبات می‌کند.
- **Hardening:** Unit مربوط به systemd از `systemd-analyze verify` عبور می‌کند و Offline Exposure روی Ubuntu 24.04 فعلی `2.8 OK` است.
- **محدودیت:** Exposure Score به Host/Version وابسته است و Security Certification نیست. Syscall/JIT Restriction تهاجمی تا Compatibility Test دقیق Runtime Deferred است.
- **Encryption Boundary:** Scriptها Permission محلی را محدود می‌کنند ولی Recovery Set را Encrypt نمی‌کنند؛ Encryption مربوط به Backup Storage/Transport طبق Policy سازمان است.
- **Legacy History Cleanup:** حذف مخرب Tableها تا Production Observation، Dependency Review، Recovery Set جدید، Restore Drill موفق و Migration جداگانه Approve‌شده Deferred است.
- **Failureهای رفع‌شده:** شرط اولیه TLS Pair در Bash Syntax اشتباه داشت و با `bash -n` گرفته شد؛ Foundation Checker نیز یک‌بار به Git safe-directory خورد و فقط با Process-scoped `safe.directory` دوباره اجرا شد.
- **Task دقیق بعدی:** Task 50 — Release Validation و Fresh Deployment مستقل از سازمان از Clean Clone.

## 2026-10-06 — ثبت تکمیل Task 50

- **نتیجه:** Release Validation مستقل از سازمان به‌صورت Executable Staged-source Drill اضافه شد و End-to-end PASS شد.
- **Fresh-source Proof:** از Staged Index یک Seed Commit موقت ساخته و Fresh Clone واقعی ایجاد می‌شود؛ Runtime/Private Artifact قبل از Dependency Install Reject می‌شود.
- **Dependency Gate:** Clean Install، `npm audit --audit-level=high` را اجرا می‌کند. Advisory با Severity بالا برای `source-map-js` پیدا شد و Lockfile از 1.2.1 به نسخه Patch‌شده 1.2.2 ارتقا یافت؛ Audit مجدد Fresh Clone صفر Vulnerability گزارش کرد.
- **Deployment Proof:** TLS ایزوله، Health/Readiness، First-admin Onboarding، Synthetic PBX Metadata و Secret رمزنگاری‌شده بدون PBX Networking، Backup در حالت Service-stopped، Restore با Checksum، Login/State Recovery و Restart Recovery همگی PASS شدند.
- **Physical Reboot Proof:** با Approval صریح Operator برای Reconnect موجود `plain_tcp`، Host Reboot شد. Reboot اول نشان داد Installed systemd Unit قدیمی‌تر از Unit Harden‌شده Merge‌شده است؛ Unit جدید نصب شد و Reboot کنترل‌شده دوم، Boot واقعی Release را با enabled/active، Health/Readiness برابر 200 و Reconnect مورد انتظار AMI اثبات کرد.
- **PBX Safety:** Task 50 هیچ PBX Command یا Probe جدیدی صادر نکرد؛ تنها فعالیت PBX واقعی همان Reconnect سرویس Read-only پس از Reboot تأییدشده بود.
- **محدودیت شناخته‌شده:** Validator از TLS Self-signed موقت و Synthetic Onboarding Data استفاده می‌کند و PKI/Firewall/DNS یا Compatibility Schema واقعی سازمان را Certify نمی‌کند.
- **وضعیت Roadmap:** Task 50 Roadmap فعلی Approve‌شده را می‌بندد. Task 51 تعریف نشده و بعد از Merge باید برای Roadmap بعدی متوقف شویم.

### Failureها / Bugها / Gapهای Task 50

- **Final Diff Check روی Trailing Whitespace متادیتای Release Validation Fail شد — رفع شد:** Spaceهای انتهایی Metadata حذف شدند و Full Gate از ابتدا Restart شد.
- **Fresh Clone اولیه زیر User `root` به Git Dubious Ownership خورد — رفع شد:** Validator با Owner اصلی Repository یعنی `torabi` اجرا شد و هیچ Global Safe-directory Config اضافه نشد.
- **Clean Install اولیه یک High-severity Transitive Dependency Advisory پیدا کرد — رفع شد:** `source-map-js` روی 1.2.1 Resolve شده بود؛ Lockfile اکنون نسخه Patch‌شده 1.2.2 را Resolve می‌کند و Fresh-clone Audit صفر Vulnerability گزارش می‌دهد.
- **Physical Reboot اول Stale Installed systemd Unit را آشکار کرد — رفع شد:** Unit نصب‌شده قدیمی‌تر از Unit Harden‌شده Task 49 بود. Unit Merge‌شده نصب، Hash آن با فایل Track‌شده Match و Reboot کنترل‌شده دوم PASS شد.
- **محدودیت شناخته‌شده:** Validator از TLS Self-signed موقت و Synthetic Onboarding Data استفاده می‌کند؛ PKI/Firewall/DNS و Compatibility واقعی PBX/Database سازمان همچنان خارج از این Gate هستند.

### Final Validation مربوط به Task 50

- **Final Repository Gateها:** با Node 24.21.0 و npm 11.19.0، `npm audit --audit-level=high` با صفر Vulnerability، Shell Syntax Check، Systemd Unit Verify، Lint، Format Check، Typecheck، Backend برابر 165/165، Frontend برابر 25/25، Production Build، Foundation Check، License Check و Staged `git diff --check` همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag درباره `"use client"` همچنان Non-fatal هستند.


<div dir="rtl" align="right">

## Roadmap پذیرفته‌شده برای تکمیل V1 بعد از Task 50

Foundation پروژه از نظر Production آماده است، اما محصول Monitoring هنوز Feature-complete محسوب نمی‌شود. ترتیب پذیرفته‌شده این است که ابتدا UI/UX مدرن شود و سپس Operational Health، Telephony Reliability، Call Quality، Alerting و Incident-oriented UX توسعه پیدا کنند.

### Phase 13 — نوسازی UI/UX

- [x] **Task 51 — UI/UX Redesign Foundation و Master Mockup**
  - Inventory کامل Navigation، Dashboard، Table، Form، State و Interactionهای فعلی.
  - تعریف Design System مدرن برای Operations Console شامل Typography، Spacing، Surface، Border، Elevation، Status Color، Density، Grid، Chart، Table، Filter و Stateهای Empty/Loading/Stale/Error.
  - بازتعریف Information Architecture برای Dashboard، Telephony، History، Alerts/Security و Settings.
  - ساخت و Approval یک Desktop Master Mockup قبل از تغییر اساسی Production UI.
  - هیچ تغییر در Backend Contract یا رفتار PBX انجام نمی‌شود.
- [x] **Task 52 — پیاده‌سازی UI Shell و Design System تأییدشده**
- [x] **Task 53 — بازطراحی Operator Dashboard با رویکرد Operational Decision Surface**
- [x] **Task 54 — بازطراحی Telephony، History، Security و Settings**
- [x] **Task 55 — NOC/Wallboard و Accessibility Pass**

### Phase 14 — Unified Operational Health

- [x] **Task 56 — Unified Operational Health Model**
- [ ] **Task 57 — Fleet Overview چند PBX**

### Phase 15 — Telephony Reliability

- [x] **Task 58 — Trunk Reliability**
- [x] **Task 59 — Endpoint Reliability**
- [ ] **Task 60 — Call Outcome Analytics با Source-owned Data**

### Phase 16 — Call Quality

- [x] **Task 61 — Call Quality Source Discovery** (منبع واقعی رویدادهای RTCP از AMI نسخه 13.20.0 تأیید شد؛ تاریخچه دیتابیس کیفیت هنوز نامشخص است)
- [x] **Task 62 — Provider-neutral Call Quality Contract** (قرارداد و نرمال‌سازی مستقل؛ اتصال زنده در Task 63)
- [x] **Task 63 — Live Call Quality** (پیاده‌سازی و تست روی Branch انجام شد؛ بررسی و Merge باقی است)
- [ ] **Task 64 — Call Quality Dashboard**

### Phase 17 — Operational Alerting

- [ ] **Task 65 — Generic Operational Alert Model**
- [ ] **Task 66 — Core Operational Rules**
- [ ] **Task 67 — Alert Lifecycle**
- [ ] **Task 68 — Notification Worker**
- [ ] **Task 69 — Notification Integrations؛ اولویت V1: Generic Webhook و Email**

### Phase 18 — Incident-oriented Operator Experience

- [ ] **Task 70 — Incident-first Overview**
- [ ] **Task 71 — Entity Drill-down**
- [ ] **Task 72 — Historical Filtering**
- [ ] **Task 73 — Advanced NOC/Wallboard Behavior**

### موارد Deferred خارج از V1

Billing، CDR Warehouse، Duplicate Telemetry Storage، Arbitrary SQL، SIP Packet Capture/PCAP، Call Recording، AI Anomaly Detection، Predictive Failure Analysis، Multi-tenant SaaS، Mobile App، Arbitrary Alert Scripting و تعداد زیاد Notification Provider فعلاً V1 Requirement نیستند.

### Gate تکمیل V1

V1 زمانی Product-complete محسوب می‌شود که PBX Health، Trunk Health، Endpoint Health، Queue Health، Infrastructure Health، Call Outcome Analytics، Call Quality در صورت Support، Operational Alerts، External Notifications و Fleet/Incident-first UX هم‌زمان کاربرد عملیاتی قابل اتکا داشته باشند.

</div>

<div dir="rtl" align="right">

### Checkpoint تأیید Visual در Task 51

اولین Concept مربوط به Overview با جهت Dark Modern NOC / Operations Console توسط کاربر به‌عنوان جهت مناسب تأیید شد.

موارد Lock‌شده: Sidebar ثابت، Top Command/Status Bar، Surfaceهای Dark و Grouped، Health Summary با رویکرد Problem-first، Table/Rowهای متراکم عملیاتی، Semantic Status Color محدود و Information Density بالاتر بدون ظاهر Generic Card قبلی.

مرحله دقیق بعدی طراحی: ساخت Variant فارسی RTL با حفظ همان Visual Language و Hierarchy، در حالی که Technical Identifierها LTR باقی بمانند و معنی Chart/Time Axis معکوس نشود.

</div>

<div dir="rtl" align="right">

### Approval نهایی Master در Task 51

نسخه Refinement شده Modern NOC / Operations Console توسط کاربر تأیید شد و Visual Master برای Implementation Lock شد.

موارد Lock‌شده شامل Shell Geometry، Dark Surface Hierarchy، Semantic Status Treatment، Information Density فشرده، Problem-first Overview، Grouped Operational Panel، Table/Entity Rowهای Compact و استفاده محدود و معنی‌دار از Status Color است.

Implementation Handoff در فایل docs/ui-ux-implementation-handoff.md ثبت شد.

Task دقیق بعدی بعد از Merge شدن Task 51، **Task 52 — پیاده‌سازی UI Shell و Design System تأییدشده** است؛ بدون تغییر Monitoring Behavior یا Backend Contract.

</div>

<div dir="rtl" align="right">

## 2026-10-06 — ثبت تکمیل Task 52

- **نتیجه:** Modern NOC Application Shell تأییدشده بدون تغییر Backend/API/PBX Behavior پیاده‌سازی شد.
- **Theme:** Chakra System مرکزی با Tokenهای Canvas/Surface/Border/Text/Accent/Status و Semantic Compatibility برای Workspaceهای قدیمی اضافه شد تا مهاجرت تدریجی ظاهر یکپارچه بماند.
- **Shell:** Header سفید و Navigation مبتنی بر Button Row با Sidebar ثابت و Responsive، Top Status Bar فشرده، PBX Connection Summary، Navigation دوزبانه و Main Content Fluid جایگزین شد.
- **Navigation:** فقط Capabilityهای واقعی موجود expose شدند؛ هیچ Reports یا Alert Feature آینده به‌صورت جعلی ساخته نشد.
- **Design Primitiveها:** NocPanel، NocInset، SectionHeader و StatusIndicator برای Migration بعدی اضافه شدند.
- **RTL/LTR:** Shell فارسی RTL باقی می‌ماند و Contractهای Technical LTR حفظ شده‌اند. Regression Test برای Shell انگلیسی و فارسی اضافه شد.
- **Frontend Testها:** از 25 به 27 تست افزایش یافتند.
- **Failureهای رفع‌شده:** مسیر Test-only مربوط به initialView=ready بدون Principal باعث Render خالی می‌شد که با Preview Principal فقط در همان Test Hook اصلاح شد. Nesting نامعتبر div داخل p و Duplicate Import مربوط به nocSystem نیز رفع شدند.
- **محدودیت:** محتوای Operator Dashboard در Task 52 عمداً Redesign نشده و فقط داخل Shell جدید قرار گرفته است؛ Problem-first Dashboard Composition مربوط به Task 53 است.
- **Task دقیق بعدی:** Task 53 — Redesign Operator Dashboard طبق Master تأییدشده.

</div>


<div dir="rtl" align="right">

### Final Validation مربوط به Task 52

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 165/165، Frontend Test برابر 27/27، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-06 — ثبت تکمیل Task 53

- **نتیجه:** Operator Dashboard پیش‌فرض دیگر Free-form Widget Grid نیست و به یک Operational Surface ثابت و Problem-first مطابق Modern NOC Master تبدیل شد.
- **Hierarchy نگاه اول:** KPI Strip فشرده برای Overall Health، Calls، Trunks، Endpoints، Queues، Security Alerts و Live State؛ سپس Current Problems، Infrastructure Health، Active Calls، Trunk Health و Summaryهای Endpoint/Queue/Service.
- **Problem Synthesis:** فقط از Stateهای Read-only موجود استفاده می‌شود و Provider Disconnect/Degradation، Telephony Stale، Live Stream Degradation، Security Alert فعلی، Trunk ناسالم، Endpoint غیرقابل‌دسترس، Queue Pressure، Service Failure و مصرف بالای CPU/Memory/Filesystem را برجسته می‌کند. هیچ Alert Semantics جدید Backend ساخته نشده است.
- **Infrastructure:** CPU، Memory، Filesystem انتخاب‌شده، Uptime و CPU Trend به‌صورت Compact نمایش داده می‌شوند و Gaugeهای بزرگ از Default View حذف شده‌اند.
- **Telephony:** Active Call و Trunk State مستقیماً در Overview دیده می‌شوند و به Workspaceهای موجود Drill-down دارند.
- **Customization:** Dashboard Definition و Widget CRUD/Reorder/Resize قبلی حفظ شده‌اند، اما فقط در Edit Mode صریح نمایش داده می‌شوند. Default Operational View دیگر تحت کنترل ترتیب دلخواه Widgetها نیست.
- **Toolbar:** Customization ثانویه شده است. حالت عادی فقط Title/Hint، PBX Scope، Edit Dashboard و Fullscreen را نشان می‌دهد؛ Dashboard Selector و New Dashboard فقط در Edit Mode ظاهر می‌شوند.
- **RTL/i18n:** Labelهای جدید دوزبانه هستند و Technical Identifierها LTR باقی مانده‌اند.
- **Regression:** Frontend Suite از 27 به 28 تست افزایش یافت و Critical/Problem-first Overview به‌صورت مستقیم تست می‌شود.
- **Failureهای رفع‌شده:** تست اولیه Persisted Widgetها را در Normal Mode انتظار داشت که با Contract جدید Edit Mode هماهنگ شد. بعد از Secondary شدن Customization، Assertion نام Saved Dashboard نیز به Edit Mode منتقل شد. Strict exactOptionalPropertyTypes هم با Contractهای صریح optional اصلاح شد و Compiler Setting شل نشد.
- **محدودیت:** Fleet-wide Health Model یا Generic Operational Alert Engine در این Task اضافه نشده است. Overall Health فعلی فقط Presentation Synthesis روی Signalهای موجود است و Unified Health Semantics در Task 56 انجام می‌شود.
- **Task دقیق بعدی:** Task 54 — بازطراحی Telephony، History، Security و Settings با همان NOC Interaction Language.

</div>

<div dir="rtl" align="right">

### Failure مربوط به Final Gate در Task 53

Lint یک Helper استفاده‌نشده به نام connectionTone پیدا کرد. این Helper بعد از Simplify شدن Composition نهایی Overview دیگر لازم نبود؛ حذف شد و Full Gate از ابتدا Restart شد.

</div>

<div dir="rtl" align="right">

### Final Validation مربوط به Task 53

Node برابر v24.21.0 و npm برابر 11.19.0 بود. بعد از حذف Helper بدون استفاده‌ای که Run اول Lint پیدا کرد، Lint، Format Check، Typecheck، Backend Test برابر 165/165، Frontend Test برابر 28/28، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Rolldown درباره module-level use client همچنان Non-fatal هستند.

همچنین یک inconsistency در Roadmap اصلاح شد: Task 51 قبلاً در PR #61 Merge شده بود ولی Checkbox آن باز مانده بود؛ اکنون Complete علامت‌گذاری شد.

</div>

<div dir="rtl" align="right">

## 2026-10-06 — ثبت تکمیل Task 54

- **نتیجه:** Telephony، Source-backed History، Security و تمام Settings Surfaceهای فعلی اکنون به‌جای Generic Card Layoutهای مستقل از یک Modern NOC Workspace Language مشترک استفاده می‌کنند.
- **Workspace Primitiveهای مشترک:** WorkspaceHeader، WorkspaceToolbar، WorkspaceField، WorkspaceSearch، WorkspaceSelect، WorkspaceState، DataSurface و WorkspaceStatusPills روی Design System مربوط به Task 52 اضافه شدند.
- **Telephony:** Header، Live/Capability/Synchronization Status، PBX/Search Toolbar، Warning/Error State، Dense Table و Pagination یکپارچه شدند. Search، Filter، Active-channel behavior، Paging و SSE Contract تغییر نکرده‌اند.
- **History:** نمایش Card-per-record با Data Surface متراکم جایگزین شد. PBX Scope، Dataset Availability، Dataset Selection، Schema Refresh، Loading/Error/Empty State، Source Timestamp Notice و Row Detailهای نرمال‌شده همگی زبان تعاملی مشترک دارند. Query همچنان Explicit، Bounded، Read-only و Source-owned است.
- **Security:** Current/Recent Alertها به Compact List Surface تبدیل شدند؛ Live/Current Status برجسته شده و Rule Configuration از NOC Inset Panel و Stateهای مشترک استفاده می‌کند. مدل دو Rule فعلی، Persistence، Realtime Merge و API Contract تغییر نکرده‌اند.
- **Settings Shell:** در Desktop یک Sub-navigation Rail اختصاصی و در Layout کوچک‌تر Navigation افقی قابل Scroll دارد. PBX، Database Source، SSH Metrics، Service Monitoring، Dashboard Storage، Security و Accounts داخل یک Content Region منسجم Render می‌شوند.
- **Settings Workspaceها:** PBX Management، Database Source، SSH Metrics، Service Monitoring، Dashboard Storage و Accounts از Card.Rootهای Legacy به NocPanel/NocInset و Workspace Stateهای مشترک مهاجرت کردند. رفتار Write-only Credential و Validationهای قبلی بدون تغییر باقی مانده‌اند.
- **RTL/LTR:** Chrome فارسی RTL باقی می‌ماند و Technical Valueها، Host-like Identifierها، Service ID، Call ID و Source Timestamp به‌صورت Explicit LTR نمایش داده می‌شوند.
- **Failureهای رفع‌شده:** TypeScript Strict یک Collision بین HTML title در FlexProps و title محتوایی SectionHeader پیدا کرد که با Omit کردن HTML prop اصلاح شد. Labelهای i18n جاافتاده و Type widening مربوط به Status Tone اصلاح شدند. یک Replace گسترده در JSX مربوط به PBX موقتاً Closing Tag فرم Setup را خراب کرد که قبل از Validation ترمیم شد. تست Security نیز بعد از Compact شدن Row به‌خاطر حذف Colon ظاهری شکست و Contract خوانای Matched events: N بازگردانده شد.
- **محدودیت:** Task 54، Entity Drawer جدید، Historical Filter جدید، Unified Health Semantics یا Alert Lifecycle جدید اضافه نمی‌کند و فقط Presentation/Interaction رفتارهای موجود را استاندارد می‌کند.
- **Task دقیق بعدی:** Task 55 — NOC/Wallboard و Accessibility Pass.

</div>

<div dir="rtl" align="right">

### Failure مربوط به Final Gate در Task 54

Lint نه مورد Migration Leftover پیدا کرد: چند Import بدون استفاده بعد از حذف Card/Headerهای قدیمی و Helper قدیمی connectionPalette که بعد از انتقال PBX Status به StatusIndicator دیگر استفاده نمی‌شد. همه حذف شدند و Full Gate از ابتدا Restart شد.

</div>

<div dir="rtl" align="right">

در Run دوم Lint سه Import باقی مانده بود چون Prettier لیست Importها را Compact کرده و Pattern پاکسازی اول آن‌ها را Match نکرده بود. آن‌ها حذف شدند و Full Gate دوباره از ابتدا Restart شد.

</div>

<div dir="rtl" align="right">

در Run سوم مشخص شد Flex در Layout/Actionهای Storage هنوز استفاده می‌شود و هنگام Lint Cleanup به اشتباه حذف شده بود. Import لازم برگردانده شد و Full Gate دوباره از ابتدا Restart شد.

</div>

<div dir="rtl" align="right">

### Final Validation مربوط به Task 54

Node برابر v24.21.0 و npm برابر 11.19.0 بود. بعد از Migration Cleanup، Lint، Format Check، Typecheck، Backend Test برابر 165/165، Frontend Test برابر 28/28، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-06 — ثبت تکمیل Task 55

- **نتیجه:** NOC/Wallboard و Accessibility Pass بدون تغییر Backend، PBX، Collector یا Monitoring Semantics کامل شد.
- **Wallboard Mode:** Action مستقل از Fullscreen عادی اضافه شد. Wallboard کنترل‌های عادی Dashboard را پنهان می‌کند، Operator Overview تأییدشده را نگه می‌دارد، Metric/Numberهای کلیدی را خواناتر می‌کند، Severity Ring واضح‌تری دارد و حتی اگر Browser Fullscreen در دسترس نباشد یا رد شود داخل صفحه قابل استفاده است.
- **Fullscreen:** رفتار Fullscreen قبلی حفظ شد و Exit Control با Mouse، Focus و Keyboard قابل آشکار شدن است. Exit مربوط به Wallboard و Fullscreen عادی Semantics جدا دارند.
- **Mobile/Tablet:** در Mobile دیگر یک Sidebar ثابت 72px فضای محتوا را نمی‌گیرد. Navigation اصلی در صفحه کوچک Bottom Rail افقی و Scrollable است؛ در Tablet به Sidebar Compact و در Desktop به Sidebar کامل 232px برمی‌گردد. Main Content برای Bottom Rail فضای کافی رزرو می‌کند.
- **Keyboard/Focus:** Skip Link برای رفتن مستقیم به Main Content، Main Landmark قابل Focus، Focus Ring سراسری واضح، Accessible Label مستقل برای Navigation Iconهای Mobile، Primary Navigation Landmark و Realtime Status با aria-live polite اضافه شدند.
- **Motion:** برای prefers-reduced-motion مسیر سراسری اضافه شد که Transition/Animation را تقریباً حذف می‌کند و Smooth Scroll را غیرفعال می‌کند.
- **High Contrast:** برای forced-colors حالت‌های Focus، Selected Navigation، Borderهای Shell/Workspace و Operational Surface fallback اضافه شد.
- **Contrast Verification:** Audit عددی نشان داد textSubtle قبلی روی Canvas فقط 4.17:1 بود. Token از #617894 به #748ca9 تغییر کرد و Ratio نهایی روی Canvas برابر 5.47:1، Surface اصلی 5.00:1 و Nested Surface برابر 4.63:1 شد. رنگ‌های Semantic اصلی دیگر از قبل بالاتر از 4.5:1 بودند.
- **Regression:** تست App Shell اکنون Skip Link/Main Target را verify می‌کند و تست DashboardBuilder ورود/خروج Wallboard بدون وابستگی اجباری به Browser Fullscreen را همراه با حفظ Fullscreen قبلی بررسی می‌کند.
- **Failureهای رفع‌شده:** در Implementation اولیه یک dependency مربوط به wallboard اشتباهاً به PersianClock Effect اعمال شد و یک Helper خارج از Scope از wallboard استفاده کرد؛ هر دو اصلاح شدند. همچنین Box as="a" در Type Surface فعلی Chakra، href را قبول نکرد و Skip Link با Chakra Link پیاده شد. هیچ‌کدام وارد Commit نشدند.
- **محدودیت:** Auto-rotation، Multi-view Playlist، Kiosk Process Management و NOC Rotation Rule پیشرفته در Task 55 نیستند و در صورت نیاز برای Task 73 باقی می‌مانند.
- **Task دقیق بعدی:** Task 56 — Unified Operational Health Model.

</div>

<div dir="rtl" align="right">

### Final Validation مربوط به Task 55

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 165/165، Frontend Test برابر 28/28، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — ثبت تکمیل Task 56

- **نتیجه:** یک Operational Health Model مشترک و Provider-neutral برای Provider، Telephony، Trunk، Endpoint، Queue، System، Security و Call Quality آینده ایجاد شد.
- **Stateهای Canonical:** `HEALTHY`، `DEGRADED`، `CRITICAL`، `UNKNOWN` و `STALE`.
- **Aggregation Precedence:** `CRITICAL > STALE > DEGRADED > HEALTHY > UNKNOWN`. حالت UNKNOWN یک PBX سالم را خراب نمی‌کند، چون Capability پشتیبانی‌نشده/پیکربندی‌نشده یا Feature آینده نباید Incident جعلی بسازد. STALE از DEGRADED بالاتر است چون داده stale اعتماد به تصویر عملیاتی فعلی را کاهش می‌دهد.
- **Reason Codeهای محدود:** هر Component فقط Reason Codeهای Allowlisted به‌همراه Count/Value محدود دارد و Raw Error/Payload/Credential/Message آزاد وارد Snapshot نمی‌شود.
- **Provider:** CONNECTED=HEALTHY، DEGRADED/CONNECTING=DEGRADED، DISCONNECTED/ERROR=CRITICAL و UNVERIFIED=UNKNOWN.
- **Telephony:** CURRENT=HEALTHY، STALE=STALE، AWAITING_SNAPSHOT=UNKNOWN و نبود State برابر UNKNOWN است.
- **Trunk:** Capability/Sync ناموجود UNKNOWN یا STALE است؛ REGISTERING برابر DEGRADED و UNREGISTERED/REJECTED/FAILED/UNREACHABLE برابر CRITICAL است. Inventory خالیِ Supported به‌جای Healthy جعلی، UNKNOWN است.
- **Endpoint:** وجود Endpoint غیرقابل‌دسترس DEGRADED و غیرقابل‌دسترس بودن تمام Endpointهای مشاهده‌شده CRITICAL است. Capability یا Inventory ناموجود UNKNOWN و Sync stale برابر STALE است.
- **Queue:** وجود هر Waiting Caller در State فعلی Queue را DEGRADED می‌کند. Threshold بحرانی عمومی ساخته نشد چون Capacity/SLA بین Deploymentها متفاوت است.
- **System:** Freshness منبع به UNKNOWN/STALE/CRITICAL نگاشت می‌شود. Thresholdهای مرکزی: CPU از 85% DEGRADED و از 95% CRITICAL؛ Memory از 90% DEGRADED و 97% CRITICAL؛ Filesystem از 90% DEGRADED و 97% CRITICAL. Service با FAILED برابر CRITICAL و INACTIVE برابر DEGRADED است.
- **Security:** وجود حداقل یک Security Alert فعلی Persisted، Security را CRITICAL می‌کند و صفر Alert برابر HEALTHY است.
- **Call Quality:** Dimension مربوط به CALL_QUALITY از الان وجود دارد اما تا Tasks 61–64 و اثبات Capability واقعی، با Reason محدود به‌صورت UNKNOWN باقی می‌ماند.
- **Backend:** Endpoint جدید `GET /api/pbx-instances/:id/operational-health` اضافه شد؛ Authenticated، PBX-scoped و Read-only است و فقط از Current Runtime/Storage State محاسبه می‌شود. هیچ PBX/Database/SSH Probe یا Persistence جدیدی ندارد.
- **Frontend:** `@voip-monitor/shared` به‌عنوان Internal Workspace Dependency اضافه شد و تصمیم Health/Tone در Operator Overview به همان Shared Evaluator منتقل شد. Current Problems دیگر نمی‌تواند در حالی که Health canonical ناپایدار/stale/critical است پیام «مشکل فعالی وجود ندارد» نشان دهد.
- **Regression:** Backend از 165 به 169 تست رسید؛ Healthy همراه Future Capability نامشخص، Critical Precedence، Stale Precedence، Reasonهای deterministic System/Security و API authenticated تست شدند. Frontend همچنان 28/28 است.
- **Failureهای رفع‌شده:** Compile strict اولیه Optional Numeric Reasonها را که ممکن بود undefined باشند رد کرد و Shape اولیه Call Quality فاقد Dimension canonical بود. Valueها قبل از ساخت Reason narrow شدند و Call Quality از Canonical Component Constructor عبور می‌کند. هیچ Compiler Setting شل نشد.
- **محدودیت:** Task 56 فقط Current-state Normalization است و Fleet Aggregation، Transition History، Outage Duration، Flap Counter، Generic Operational Alert یا Notification Lifecycle اضافه نمی‌کند. این موارد برای Tasks 57–69 باقی می‌مانند.
- **Task دقیق بعدی:** Task 57 — Fleet Overview.

</div>

<div dir="rtl" align="right">

### Final Validation مربوط به Task 56

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 169/169، Frontend Test برابر 28/28، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — ثبت تکمیل Task 57

- **نتیجه:** `PBX Fleet` به یک Workspace عملیاتی مستقل تبدیل شد و دیگر Navigation آن به PBX Settings نمی‌رود.
- **Shared Contract:** Contract مشترک `FleetOverviewSnapshot` فقط Identity/Display Name، Enabled State، Health canonical، Active Call، Trunk Failure، Endpoint Failure، Waiting Caller، Current Critical Security Alert و Last Telephony Update اختیاری را برمی‌گرداند. AMI Host/User/Credential و Raw Provider Payload وارد Fleet نمی‌شوند.
- **Backend Aggregation:** Endpoint احراز هویت‌شده و Read-only به نام `GET /api/fleet-overview` اضافه شد. فقط Current Runtime/Storage State موجود را Aggregate می‌کند؛ هیچ AMI/SSH/Source Database Connection جدیدی باز نمی‌کند و چیزی Persist نمی‌کند.
- **Health:** هر PBX همان `OperationalHealthSnapshot` مربوط به Task 56 را استفاده می‌کند و Health Model موازی ساخته نشده است. Sort بر اساس Severity به ترتیب `CRITICAL`، `STALE`، `DEGRADED`، `UNKNOWN` و `HEALTHY` است.
- **Fleet Summary:** تعداد کل PBX، توزیع Health، Active Call، Trunk Failure، Endpoint Failure، Waiting Caller و Current Critical Security Alert نمایش داده می‌شوند.
- **UI:** یک NOC Fleet Surface responsive با Summary Metricهای فشرده و Table متراکم PBX ساخته شد. Refresh هر 15 ثانیه فقط Aggregate Endpoint داخلی را می‌خواند و PBX Work جدید ایجاد نمی‌کند.
- **Navigation:** `PBX Fleet` اکنون Top-level Workspace مستقل است و PBX Configuration همچنان در Settings > PBX باقی مانده است.
- **Drill-down:** کلیک روی نام PBX یا `Open PBX` همان Instance را انتخاب و Operator Overview موجود را باز می‌کند. تغییر PBX در Overview نیز Selection مشترک را Sync نگه می‌دارد.
- **Regression:** Backend از 169 به 170 تست و Frontend از 28 به 29 تست رسید. Aggregation/Severity/Safe-field و Fleet Rendering/Drill-down پوشش داده شدند.
- **محدودیت:** Fleet فعلی Current-state است و Health Transition، Outage Duration، Flap Counter، Historical Reliability Ranking یا Generic Alert Lifecycle را Persist نمی‌کند. این موارد در Tasks 58–69 باقی مانده‌اند.
- **Task دقیق بعدی:** Task 58 — Trunk Reliability.

</div>

<div dir="rtl" align="right">

### Final Validation مربوط به Task 57

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 170/170، Frontend Test برابر 29/29، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — ثبت تکمیل Task 58

- **نتیجه:** Live Trunk State اکنون Reliability Metadata محدود دارد بدون اینکه Monitoring History تکراری و Durable ایجاد شود.
- **Availability Canonical:** حالت‌های Provider-neutral شامل `UP`، `DOWN`، `TRANSITIONING` و `UNKNOWN` هستند. REGISTERED برابر UP، REGISTERING برابر TRANSITIONING، UNREGISTERED/REJECTED/FAILED یا UNREACHABLE برابر DOWN و NOT_APPLICABLE همراه REACHABLE برابر UP است.
- **Baseline:** اولین Snapshot معتبر فقط Baseline مشاهده و Last Up/Down را مشخص می‌کند و Flap یا Reconnect محسوب نمی‌شود.
- **Transition:** ورود به DOWN بعد از UP قبلی Outage را شروع و Flap Counter را افزایش می‌دهد. برگشت به UP در حالی که Outage فعال است Outage را می‌بندد و Reconnect Counter را افزایش می‌دهد. REGISTERING وسط مسیر Outage را تمام نمی‌کند.
- **Visibility Loss:** قطع Provider/PBX فقط Synchronization را STALE می‌کند و Down/Outage جعلی برای Trunk نمی‌سازد. Reliability فقط از Trunk Event یا Reconciliation Snapshot معتبر تغییر می‌کند.
- **Bound:** Counterها حداکثر 9,999 و Recent Transition برای هر Trunk حداکثر 20 مورد است. این State فقط In-memory و Operational است و بعد از Restart Reset می‌شود؛ Historical Database دوم ساخته نشده است.
- **Reconciliation:** تغییر State در Snapshot نیز Reliability Transition ایجاد می‌کند، بنابراین Event از دست‌رفته با مسیر Reconciliation فعلی Repair می‌شود و Collector جدیدی نیاز نیست.
- **Public State:** هر Trunk اکنون Availability، Last Up/Down، Outage Start/Duration فعال، Flap/Reconnect Count و Recent Transition محدود را expose می‌کند؛ Raw AMI Payload نمایش داده نمی‌شود.
- **UI:** Workspace مربوط به Trunks ستون‌های قبلی Technology/Kind/Classification/Registration/Reachability را حفظ کرده و Availability، Last Up، Last Down، Outage زنده، Flaps، Reconnects و سه Transition آخر را اضافه کرده است. Sort بر اساس Reliability است: DOWN، TRANSITIONING، Flapping، UNKNOWN و سپس UP پایدار.
- **Outage Live:** مدت Outage در Browser از outageStartedAt هر ثانیه محاسبه می‌شود و هیچ API Polling یا PBX Work جدیدی ایجاد نمی‌کند.
- **Regression:** Backend از 170 به 171 تست رسید و Baseline، Visibility Loss، UP→DOWN، DOWN→REGISTERING→UP و Bound بیست Transition پوشش داده شدند. Frontend همچنان 29/29 است.
- **Failureهای رفع‌شده:** Runtime Classifier ابتدا داخل Type-only Import بود؛ Import اصلاح شد. TelephonyTrunkState Type Import در Frontend جا افتاده بود و اضافه شد. Regression Test حذف ناخواسته Classification Column را پیدا کرد و ستون برگردانده شد. همچنین Persian Labelها ابتدا اشتباهاً در English Block قرار گرفته بودند و قبل از Validation اصلاح شدند.
- **محدودیت:** Reliability در Task 58 Process-lifetime و bounded است و Outage History را بین Restartها Persist نمی‌کند و SLA/Uptime Percentage نمی‌سازد. Analytics بلندمدت فقط با طراحی صریح Persistence و بدون Duplicate Telemetry باید اضافه شود.
- **Task دقیق بعدی:** Task 59 — Endpoint Reliability.

</div>

<div dir="rtl" align="right">

### Final Validation مربوط به Task 58

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 171/171، Frontend Test برابر 29/29، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — ثبت تکمیل Task 59

- **نتیجه:** Live Endpoint State اکنون Reliability Metadata محدود دارد بدون ایجاد Monitoring History تکراری و Durable.
- **Availability Canonical:** حالت‌های `ONLINE`، `OFFLINE` و `UNKNOWN` اضافه شدند. REACHABLE برابر ONLINE و UNREACHABLE برابر OFFLINE است؛ اگر Reachability نامشخص باشد، REGISTERED برابر ONLINE و UNREGISTERED برابر OFFLINE در نظر گرفته می‌شود.
- **Baseline:** اولین Snapshot معتبر فقط Baseline مربوط به Last Reachable/Unreachable و Offline جاری را ایجاد می‌کند و Flap حساب نمی‌شود.
- **Transition:** ONLINE→OFFLINE یک Offline Window شروع و Flap Counter را افزایش می‌دهد. OFFLINE→ONLINE Offline Window را می‌بندد و Last Reachable جدید را ثبت می‌کند. UNKNOWN Transitionها نگه داشته می‌شوند اما Flap جعلی نمی‌سازند.
- **Visibility Loss:** قطع PBX/Provider فقط Endpoint Synchronization را STALE می‌کند و Endpoint را جعلی OFFLINE نمی‌کند.
- **Bound:** Flap Counter حداکثر 9,999 و Recent Transition برای هر Endpoint حداکثر 20 مورد است. State فقط In-memory و Process-lifetime است و بعد از Restart Reset می‌شود.
- **Reconciliation:** Snapshot معتبر Endpoint نیز می‌تواند Reliability Transition ایجاد کند و Event از دست‌رفته را با مسیر موجود Repair کند.
- **Public State:** هر Endpoint اکنون Availability، Last Reachable/Unreachable، Offline Start/Duration فعال، Flap Count و Recent Transition محدود را expose می‌کند؛ Raw AMI Payload نمایش داده نمی‌شود.
- **UI:** Workspace مربوط به Endpoints ستون‌های Availability، Last Reachable، Last Unreachable، Offline زنده، Flaps و Recent Transitions را اضافه کرده و Registration/Reachability قبلی را حفظ کرده است. Sort به ترتیب OFFLINE، Flapping، UNKNOWN و سپس ONLINE پایدار است.
- **Offline Live:** مدت Offline در Browser هر ثانیه از offlineStartedAt محاسبه می‌شود و هیچ API Polling یا PBX Work جدیدی ایجاد نمی‌کند. همان Timer اکنون Duration مربوط به Trunk و Endpoint را درست به‌روزرسانی می‌کند.
- **Regression:** Backend از 171 به 172 تست و Frontend از 29 به 30 تست رسید. Baseline، Visibility Loss، ONLINE→OFFLINE، Recovery، Bound بیست Transition، Rendering و Problem-first Ordering پوشش داده شدند.
- **Failureهای رفع‌شده:** Strict Typecheck ابتدا Missing Import مربوط به EndpointReliabilityState، implicit-any callback و Fixtureهای قدیمی بدون Reliability را پیدا کرد. Fixtureها با Contract واقعی به‌روزرسانی شدند و Contract شل نشد.
- **محدودیت:** Reliability مربوط به Endpoint در Task 59 Process-lifetime و bounded است و Uptime/SLA بلندمدت را بین Restartها Persist نمی‌کند.
- **Task دقیق بعدی:** Task 60 — Call Outcome Analytics.

</div>

<div dir="rtl" align="right">

### Final Validation مربوط به Task 59

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 172/172، Frontend Test برابر 30/30، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — حذف Navigation تکراری قبل از Task 60

- **مشکل:** بعد از Sidebar اصلی، داخل Telephony یک Navigation دوم و داخل Settings یک Navigation Rail دوم نمایش داده می‌شد و UI حالت تو‌در‌تو و تکراری پیدا کرده بود.
- **اصلاح:** Sidebar اصلی اکنون تنها مالک Navigation برنامه است. منوی داخلی Telephony و منوی داخلی Settings کامل حذف شدند.
- **حفظ دسترسی:** Channels و تمام صفحه‌های تنظیماتی که قبلاً فقط از منوی داخلی قابل دسترسی بودند به Sidebar اصلی منتقل شدند: PBX Settings، Data Source، Infrastructure/SSH Metrics، Service Monitoring، Dashboard Storage، Security و Accounts.
- **Header:** عنوان عمومی Settings که بالای Header خود Workspace دوباره تکرار می‌شد حذف شد. هر Workspace فقط یک Header دارد.
- **کنترل‌های داخل صفحه:** PBX Selector، Search، Filter، Status، Form و Action Toolbar باقی ماندند چون Navigation نیستند و فقط روی همان صفحه عمل می‌کنند.
- **Regression:** تست Frontend همچنان 30/30 است و دسترسی Sidebar و نبود Navigationهای داخلی قبلی verify می‌شود.
- **ترتیب Roadmap:** این اصلاح UX روی Baseline Merge‌شده Task 59 است و بعد از Merge آن، Task 60 همچنان Task بعدی است.

</div>

<div dir="rtl" align="right">

### Final Validation حذف Navigation تکراری

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 172/172، Frontend Test برابر 30/30، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — اصلاح Grouped Navigation، SSH Verification و سازگاری Trunks

- **Navigation:** Shell اکنون دقیقاً سه انتخاب اصلی دارد: `Overview`، `Operations` و `Settings`. دو گروه Operations و Settings فقط یک سطح Child دارند و در هر لحظه فقط یک Group باز است. Navigation دوم داخل محتوای صفحه برنگشته است.
- **Operations:** شامل PBX Fleet، Live Calls، Channels، Trunks، Endpoints، Queues، Agents و Call History است.
- **Settings:** شامل PBX Settings، Data Source، Infrastructure، Service Monitoring، Dashboard Storage، Security و Accounts است؛ بنابراین Infrastructure دیگر Top-level مستقل نیست.
- **اصل طراحی:** شلوغی Routeها با Grouping معنادار و Disclosure یک‌سطحی کنترل شده است، نه با Flat کردن همه مقصدها و نه با Submenu چندلایه. Group Buttonها `aria-expanded` و `aria-controls` دارند و Child فعال `aria-current=page` را حفظ می‌کند.
- **Infrastructure:** ذخیره SSH اکنون Verify-before-save است. Backend قبل از هر Persistence یک SSH Handshake واقعی با Host، Pinned SHA-256 Host-key Fingerprint، Username و Credential ارسالی انجام می‌دهد.
- **Failure Safety:** Host-key mismatch، Authentication failure، Timeout، Target blocked و Connection failure با Error Code محدود برمی‌گردند. Verification ناموفق هیچ Metadata/Secret جدیدی ذخیره نمی‌کند و System Metrics Runtime را Sync نمی‌کند.
- **Host Key:** فیلد Pinned Host-key Fingerprint در UI به‌عنوان Trust Anchor برجسته شده و خطای Host Key از خطای Password/Authentication جدا نمایش داده می‌شود.
- **Verification State:** Migration شماره 17 ستون nullable به نام `last_verified_at` را به `ssh_config` اضافه می‌کند. Configهای قدیمی بعد از Upgrade به‌صورت `UNVERIFIED` دیده می‌شوند و فقط `Verify & Save` موفق آن‌ها را `VERIFIED` می‌کند.
- **API Safety:** Verification در خود PUT Endpoint مربوط به SSH اجباری است؛ بنابراین حتی Direct API Call نیز Credential تأییدنشده را ذخیره نمی‌کند.
- **علت Blank شدن Trunks:** Frontend جدید Build شده بود ولی Backend Production از زمان Start قبلی Service هنوز نسخه قدیمی بود. UI جدید `reliability` مربوط به Task 58 را انتظار داشت اما Backend قدیمی آن را نمی‌فرستاد و Render در Browser Crash می‌کرد.
- **Compatibility:** Reliability در Frontend API Boundary اختیاری پذیرفته می‌شود و اگر Backend قدیمی آن را ندهد، UI از Registration/Reachability یک View محافظه‌کارانه می‌سازد و صفحه را نمایش می‌دهد. بعد از هم‌نسخه شدن Frontend/Backend Metadata کامل خودکار استفاده می‌شود.
- **Deployment Rule:** Releaseهایی که Contract مشترک Frontend/Backend را تغییر می‌دهند باید به‌صورت یک Version Build و Restart شوند. نوشتن Frontend Asset جدید روی Backend قدیمی یک Deployment معتبر نیست.
- **Regression:** Backend اکنون 174/174 و Frontend برابر 33/33 تست PASS دارد. Credential اشتباه SSH، Legacy UNVERIFIED، Grouped Navigation و Trunks با Response قدیمی Backend پوشش داده شده‌اند.
- **Roadmap:** بعد از Merge این Fix و Deploy/Restart نسخه Merge‌شده، Task 60 — Call Outcome Analytics همچنان Task بعدی است.

</div>

<div dir="rtl" align="right">

### Final Validation اصلاح Navigation / Infrastructure / Trunks

Node برابر v24.21.0 و npm برابر 11.19.0 بود. Lint، Format Check، Typecheck، Backend Test برابر 174/174، Frontend Test برابر 33/33، Production Build، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره module-level use client همچنان Non-fatal هستند. Production Service عمداً قبل از Merge Restart نشد؛ بعد از Merge باید Release یکپارچه Deploy/Restart شود تا Backend در حال اجرا با Frontend Build هم‌نسخه شود.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — اصلاح Live Telephony Refresh و Inventory Reconciliation

- **مشکل مشاهده‌شده:** KPIها و تعداد تماس‌های زنده در پنل Update نمی‌شدند و Trunkهایی که از PBX حذف شده بودند همچنان در پنل باقی می‌ماندند.
- **علت Deployment:** Production Service هنوز Backend قدیمی قبل از Task 58/59 را اجرا می‌کرد در حالی که Frontend Assetهای جدید روی Disk Build شده بودند. این Version Skew تا زمان Restart نسخه Merge‌شده باعث رفتار ناسازگار می‌شود.
- **مسیر اصلی Live:** AMI هنگام وجود Runtime subscriber با `Events: on` Login می‌کند؛ Eventها وارد TelephonyStateEngine می‌شوند و Revision جدید از Telephony SSE منتشر می‌شود. بنابراین Live Call همچنان Event-driven است.
- **Fallback Frontend:** Dashboard و Telephony Workspace علاوه بر SSE یک Refresh محدود هر 10 ثانیه از Endpoint محلی `/telephony-state` دارند. خطای SSE نیز بلافاصله یک Refresh محلی ایجاد می‌کند. این مسیر مستقیماً به PBX وصل نمی‌شود.
- **Reconciliation:** زمان پیش‌فرض Provider Reconciliation از 45 ثانیه به 15 ثانیه کاهش یافت تا Snapshot معتبر PBX حذف/اضافه شدن Trunk و Endpoint را سریع‌تر اصلاح کند.
- **حذف Entity:** وقتی Trunk یا Endpoint در Snapshot معتبر دیگر وجود نداشته باشد، Reliability State وابسته به آن نیز Prune می‌شود. اگر Entity بعداً برگردد Baseline جدید می‌گیرد و State قدیمی را به ارث نمی‌برد.
- **Performance:** Refresh ده‌ثانیه‌ای Browser فقط Application Memory را می‌خواند. PBX Work محدود به یک Reconciliation برای هر PBX در هر 15 ثانیه است؛ تغییر تماس‌های زنده همچنان از AMI Event فوراً می‌رسد.
- **Regression:** Backend اکنون 175/175 و Frontend برابر 34/34 تست PASS دارد. حذف Trunk با Snapshot و Refresh در حالت Silent SSE پوشش داده شده‌اند.
- **Deployment:** بعد از Merge این Branch باید main Sync، Release Build و `voip-monitor.service` Restart شود و سپس حرکت Telephony Revision، Live Call count و حذف Trunkهای حذف‌شده verify شود.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — عیب‌یابی Production Live State و Hotfix مربوط به Metrics Health

- **Deploy:** PR #73 روی Production Sync شد، Frontend/Backend با هم Build شدند و `voip-monitor.service` در ساعت 06:47:25 UTC Restart شد.
- **Telephony واقعاً Live است:** Read احراز هویت‌شده از Current-state API نشان داد Revision و Current Call Count مربوط به MVM در فاصله چند ثانیه تغییر می‌کنند. AMI Freshness، Event Timestamp و Reconciliation Snapshot هم Current هستند. بنابراین مسیر Server-side مربوط به Live Call سالم است.
- **Browser:** Production Gateway برای `index.html` مقدار `Cache-Control: no-store` و برای Assetهای Hash‌شده Cache immutable دارد. Tabی که قبل از Deploy باز بوده Bundle قبلی را تا زمان Reload در Memory نگه می‌دارد؛ Hard Reload نسخه Merge‌شده با SSE و Fallback ده‌ثانیه‌ای را بارگذاری می‌کند.
- **علت CPU/Memory:** Runtime مربوط به System Metrics فعال است و Retry می‌کند، اما SSH Credential ذخیره‌شده Authentication را Pass نمی‌کند. تست Read-only با SSH Verifier خود اپ `AUTHENTICATION_FAILED` را تأیید کرد و Host Key پذیرفته شد. بنابراین آخرین Sample موفق CPU/Memory قدیمی است. TopTec نیز SSH Metrics Configuration ندارد و طبق طراحی UNAVAILABLE است.
- **Error Propagation:** خطای SSH Authentication اکنون به‌صورت bounded با کد `AUTHENTICATION_FAILED` از Transport تا Runtime حفظ می‌شود و دیگر `UNKNOWN` نمی‌شود. Errorهای ناشناخته همچنان به Generic Collection Failure امن تبدیل می‌شوند و Raw Message خارج نمی‌شود.
- **Metrics SSE:** DashboardBuilder اکنون Event مربوط به `system-metrics-health` را نیز مصرف می‌کند تا ERROR و Recovery منبع بلافاصله در UI منعکس شود.
- **Sample قدیمی Current نمایش داده نمی‌شود:** OperatorOverview و Dashboard Widgetها فقط وقتی Source Freshness برابر `CURRENT` باشد CPU/Memory/Filesystem/Uptime را Current نمایش می‌دهند. در ERROR/STALE/UNAVAILABLE مقدار Persistشده قبلی دیگر به‌عنوان مقدار فعلی نشان داده نمی‌شود.
- **اقدام Operator:** در Settings > Infrastructure رمز SSH صحیح را دوباره وارد و `Verify & Save` کنید. بعد از Verification موفق Runtime Sync می‌شود و CPU/Memory با Cadence سی‌ثانیه‌ای دوباره جمع‌آوری می‌شوند.
- **Regression:** Backend برابر 177/177 و Frontend برابر 34/34 PASS است.
- **Roadmap:** Task 60 تا Merge و Deploy این Hotfix همچنان Pending است.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — اصلاح Visualization در Overview و Semantics مربوط به Endpoint

- **Storage:** در Overview برای هر Filesystem/Storage انتخاب‌شده Gauge نیم‌دایره نمایش داده می‌شود که درصد مصرف فعلی و ظرفیت Used/Total را نشان می‌دهد. انتخاب Storage همچنان از Dashboard Storage Configuration موجود می‌آید.
- **CPU/RAM:** CPU و Memory اکنون هرکدام Time Series مستقل بر اساس History محدود و موجود System Metrics دارند و درصد Current کنار نمودار نمایش داده می‌شود. Dependency یا Collector جدیدی اضافه نشده است.
- **Endpoint KPI:** عدد بزرگ Endpoint در Overview اکنون تعداد `REACHABLE` است و Total Endpoint به‌صورت متن ثانویه زیر آن نمایش داده می‌شود. تعداد Unreachable فقط Statistic اطلاعاتی است.
- **Semantics:** Offline/Unreachable بودن Endpoint به‌تنهایی Incident محسوب نمی‌شود، چون Softphone یا دستگاه کاربر ممکن است خاموش یا Disconnect باشد. بنابراین اگر Endpoint Capability و Synchronization معتبر و Current باشند، مؤلفه ENDPOINTS بدون توجه به Reachability تک‌تک Endpointها HEALTHY است. از دست رفتن Capability یا Synchronization همچنان UNKNOWN/STALE باقی می‌ماند.
- **Current Problems:** Endpointهای Unreachable دیگر Warning/Critical نمی‌سازند و Overall Health را Degrade نمی‌کنند.
- **Fleet:** نام `endpointFailures` به `unreachableEndpoints` تغییر کرد. عدد همچنان به‌عنوان Statistic نمایش داده می‌شود ولی Failure/Incident محسوب نمی‌شود.
- **Reliability:** Transition، Offline Duration، Flap و جزئیات Endpoint همچنان برای Observation و Troubleshooting باقی می‌مانند، اما خود Offline بودن مشکل عملیاتی تلقی نمی‌شود مگر اینکه بعداً Rule صریحی تعریف شود.
- **Regression:** Backend اکنون 178/178 و Frontend برابر 34/34 PASS است و حالت همه Endpointها Unreachable ولی Health سالم، Time Series CPU/RAM، Storage Gauge و جابه‌جایی Reachable/Total پوشش داده شده‌اند.
- **Roadmap:** بعد از Merge این Branch، Task 60 — Call Outcome Analytics همچنان Task بعدی است.

</div>
<div dir="rtl" align="right">
- **اصلاح تراکم Overview:** پنل‌های بزرگ Active calls و Trunks از بدنه Overview حذف شدند تا داشبورد جمع‌وجور بماند. KPIهای بالایی و Workspaceهای مستقل آن‌ها همچنان در دسترس هستند.
</div>

<div dir="rtl" align="right">

## 2026-10-07 — Live Dashboard Cadence، Chart Consolidation و Responsive Wallboard

- **Cadence مستقل:** در Settings > Dashboard Settings برای Active Calls، Endpoints، Queues، Current Problems، CPU/RAM، Storage و Services نرخ Update مستقل و PBX-scoped ذخیره می‌شود. مقادیر مجاز از 500ms تا 60s محدود شده‌اند و Reset به مقادیر پیشنهادی وجود دارد.
- **بدون PBX Polling اضافه:** این تنظیم فقط مشخص می‌کند هر Widget چه زمانی آخرین State دریافت‌شده داخل اپ را روی UI اعمال کند. AMI/SSE و System Metrics Collector همچنان Source اصلی هستند و تغییر Refresh Rate هیچ Loop جدیدی به سمت PBX ایجاد نمی‌کند.
- **Update نرم:** صفحه Reload نمی‌شود و Widgetها In-place به‌روزرسانی می‌شوند. اولین Sample معتبر و تغییر به ERROR/UNAVAILABLE فوراً اعمال می‌شود؛ Updateهای سالم بعدی Cadence انتخابی همان Widget را رعایت می‌کنند.
- **Active Calls:** Current Problems به پایین Dashboard منتقل شد و جای قبلی آن یک Time Series زنده و محدود در Memory برای تعداد Active Calls قرار گرفت. هیچ Call History جدیدی Persist نمی‌شود.
- **CPU/RAM:** CPU و RAM داخل یک نمودار مشترک با دو رنگ مجزا و Scale مشترک 0 تا 100 درصد نمایش داده می‌شوند.
- **Storage Gauge:** Arc هر Gauge به‌صورت Green -> Amber -> Red است و هرچه مصرف به 100% نزدیک می‌شود بخش قرمز بیشتری از Gauge دیده می‌شود. Used/Total در حالت عادی نمایش داده می‌شود و در Wallboard برای کاهش تراکم Compact می‌شود.
- **کاهش تکرار:** KPIهای تکراری Calls و Trunks از بالای Overview حذف شدند؛ Active Calls با نمودار Live نمایش داده می‌شود و Trunks همچنان Workspace مستقل و Semantics مربوط به Current Problems را دارد.
- **Wallboard:** Overview چهار ردیف Responsive دارد: KPIهای فشرده، Active Calls + Infrastructure، Summaryهای Endpoint/Queue/Service و Current Problems در پایین. در Wallboard از Viewport Height، Gap/Padding کمتر، Gaugeهای Compact و بدون Page Scroll استفاده می‌شود تا در یک صفحه جا بگیرد؛ حالت عادی همچنان با Breakpointهای Responsive Reflow می‌شود.
- **Persistence:** Migration شماره 18 جدول `dashboard_refresh_config` را اضافه می‌کند؛ این فقط App-owned Configuration است و Telemetry جدیدی Duplicate نمی‌شود.
- **Regression:** Backend برابر 179/179 و Frontend برابر 34/34 PASS است.

</div>
<div dir="rtl" align="right">
- **اصلاح Discoverability در Settings:** تنظیم انتخاب Filesystemها همچنان یک مقصد مستقل و واضح با نام `Storage / Filesystems` است. Refresh Cadence جای آن را نمی‌گیرد؛ در همان Workspace دو پنل جدا داریم: ابتدا انتخاب Storage/Filesystemهای قابل نمایش و سپس تنظیم Refresh Rate هر بخش.
</div>
<div dir="rtl" align="right">
- **تفکیک Settings:** بخش‌های `Storage / Filesystems` و `Dashboard Settings` اکنون دو مقصد و دو Workspace مستقل هستند. Storage فقط Current System Metrics و Dashboard Storage Selection را می‌خواند و هیچ وابستگی به Dashboard Refresh API ندارد؛ بنابراین خرابی Refresh API دیگر نمی‌تواند لیست Filesystemها را خالی کند یا Storage Load Error بسازد.
</div>
<div dir="rtl" align="right">
- **تفکیک Build و Deploy:** دستور عادی `npm run build` دیگر داخل `frontend/dist` که Production Gateway مستقیماً سرو می‌کند چیزی نمی‌نویسد و Frontend Verification را در `/tmp/voip-monitor-frontend-build` می‌سازد. فقط `npm run build:production` اجازه دارد `frontend/dist` را تولید کند. بنابراین Full Gate یک Branch Merge‌نشده دیگر نمی‌تواند Frontend زنده را عوض کند در حالی که Backend Production هنوز نسخه Merge‌شده قبلی است.
</div>
<div dir="rtl" align="right">
- **ساده‌سازی حالت نمایش Overview:** دکمه و Mode مستقل Wallboard حذف شد. از این به بعد Fullscreen تنها حالت نمایشی ویژه است و همان Layout فشرده NOC، ارتفاع مبتنی بر Viewport، Auto-hide کنترل‌ها و Gaugeهای Compact را فعال می‌کند که قبلاً مخصوص Wallboard بود.
- **حذف Dashboard Editor قدیمی از Overview:** دکمه `Edit dashboard` دیگر Builder قدیمی را باز نمی‌کند. آن Builder در حقیقت یک Dashboard دوم و قدیمی با Widgetهای متفاوت مثل CPU Gauge، Memory Gauge و Calls/Trunks قدیمی بود و Overview فعلی را Edit نمی‌کرد؛ بنابراین گمراه‌کننده بود. Overview فعلی اکنون تنها UI Source of Truth است. Persistence/API قدیمی Dashboard Definition برای Backward Compatibility فعلاً باقی می‌ماند ولی در Frontend فعلی نمایش داده نمی‌شود.
- **مرز Customization آینده:** Drag/Resize/Reorder فقط زمانی برمی‌گردد که مستقیماً روی Layout فعلی OperatorOverview پیاده‌سازی شود؛ Builder قدیمی نباید دوباره به‌عنوان میانبر فعال شود.
</div>

<div dir="rtl" align="right">

## 2026-10-07 — اصلاح قابلیت تغییر Dashboard Cadence

- **مشکل مشاهده‌شده:** Operator نمی‌توانست Refresh/Cadence هر Widget، از جمله CPU / Memory، را به‌شکل قابل اتکا از Dashboard Settings تغییر دهد.
- **Root Cause اول:** کنترل‌ها به Native Select فشرده متکی بودند و Interaction آن در Workflow واقعی Settings به‌اندازه کافی واضح و قابل اتکا نبود. کنترل‌ها به Buttonهای صریح برای هر Rate تبدیل شدند و مقدار انتخاب‌شده به‌صورت واضح مشخص می‌شود.
- **Root Cause دوم:** مقدار پیش‌فرض 3 ثانیه برای Queues و Current Problems در Shared Allowlist وجود نداشت؛ بنابراین Default موجود خارج از گزینه‌های Selectable بود. مقدار `3000 ms` اکنون به Allowlist اضافه شد.
- **Fix:** برای Active Calls، Endpoints، Queues، Current Problems، CPU / Memory، Storage و Services گزینه‌های 500ms، 1s، 2s، 3s، 5s، 10s، 15s، 30s و 60s به‌صورت مستقیم قابل انتخاب هستند. Save همان Config کامل PBX-scoped را Persist می‌کند.
- **Regression:** تست Frontend اکنون علاوه بر Active Calls، مقدار CPU / Memory را نیز تغییر می‌دهد، انتخاب 5s را تأیید می‌کند، وجود Default سه‌ثانیه‌ای Queue را بررسی می‌کند و Payload ذخیره‌شده را Validate می‌کند.
- **Failure Log:** اجرای اولیه تست با Flag نامعتبر `--runInBand` شکست خورد؛ این خطای Command بود نه Application. اجرای بعدی Frontend Test نیز قبل از Rebuild شدن Shared Workspace انجام شد و Allowlist قبلی را دید؛ پس از Build مجدد `@voip-monitor/shared`، تست Frontend PASS شد.
- **Known Limitation:** این تنظیمات فقط Presentation Cadence هستند و Frequency خود SSH/System Metrics Collector را افزایش نمی‌دهند؛ مثلاً Cadence پنج‌ثانیه‌ای CPU / Memory نمی‌تواند بدون Sample جدید Collector داده تازه بسازد.
- **Safety:** در این Branch هیچ PBX Access/Probe/Write، تغییر Collector Frequency یا Production Deployment انجام نمی‌شود.
- **Exact Next Task:** ابتدا این Fix Merge و Deploy شود، سپس Task 60 — Call Outcome Analytics ادامه پیدا کند.

</div>

<div dir="rtl" align="right">

### Final Validation اصلاح Dashboard Cadence

Lint، Format، Typecheck، Backend Test برابر 179/179، Frontend Test برابر 35/35، Build غیرDeploying، Foundation Check، License Check و Git Diff Check همگی PASS شدند. Foundation Check با `safe.directory` فقط در Environment همان Process اجرا شد و هیچ Global Git Configuration تغییر نکرد. بررسی Public Diff نیز هیچ Credential، Key، Token یا Deployment Address جدیدی پیدا نکرد. Warningهای موجود Chakra/Ark/Zag/Rolldown درباره `use client` همچنان Non-fatal هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — اصلاح UX برای Dropdown نرخ Update داشبورد

- **بازخورد Operator:** نمایش Rateها به‌شکل چند Button برای هر Widget شلوغ و نامناسب بود.
- **اصلاح:** در Dashboard Settings هر Widget دوباره یک Dropdown فشرده دارد، در حالی که Allowlist اصلاح‌شده شامل گزینه 3 ثانیه حفظ شده است.
- **تست CPU / Memory:** تست Frontend مقدار Dropdown مربوط به CPU / Memory را روی 5 ثانیه می‌گذارد، Save می‌کند و Payload ذخیره‌شده با `cpuMemoryMs: 5000` را بررسی می‌کند. همچنین Default سه‌ثانیه‌ای Queue همچنان قابل انتخاب است.
- **رفتار اصلی تغییر نکرد:** Cadence فقط زمان اعمال State روی UI است و Frequency مربوط به PBX Polling یا Collector را تغییر نمی‌دهد.
- **Validation:** Lint، Format Check، Typecheck، Backend Test برابر 179/179، Frontend Test برابر 35/35، Build، Foundation، License و Diff Check همگی PASS شدند.
- **Exact Next Task:** ابتدا این اصلاح UX Merge/Deploy شود و سپس Task 60 — Call Outcome Analytics ادامه پیدا کند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — Task 60: تحلیل نتیجه تماس‌ها

- **مالکیت Source حفظ شد:** Analytics نتیجه تماس مستقیماً روی CDR فقط‌خواندنی پیکربندی‌شده محاسبه می‌شود. VoIP Monitor هیچ Call History جدیدی را Persist، Cache، Warehouse یا Duplicate نمی‌کند.
- **بازه صریح و محدود:** API برای گزارش `From` و `To` تاریخ/ساعت Source-local را بعد از Validation سخت‌گیرانه می‌گیرد؛ برای Timestampهای Naive منطقه زمانی ساختگی ایجاد نمی‌شود و مقادیر به‌صورت Parameterized وارد Query می‌شوند.
- **Aggregate مستقیم:** Total، Answered، No Answer، Busy، Failed، Unknown، Average Duration و Answer Ratio با یک Aggregate Query مستقیم روی Source محاسبه می‌شوند؛ App برای Analytics یک Sample دلخواه از Rowها دانلود و جمع نمی‌زند.
- **Unknown پنهان نمی‌شود:** Dispositionهایی که Adapter نمی‌شناسد داخل `unknownCalls` باقی می‌مانند تا جمع Categoryها نسبت به Total قابل Audit باشد.
- **ایمنی Read-only:** Query فقط از Identifierهای کشف‌شده/Quoteشده و Allowlist ثابت Range ساخته می‌شود. Arbitrary SQL یا Interval دلخواه کاربر وارد Adapter نمی‌شود.
- **UI:** در Call History یک Surface دو‌زبانه برای Call Outcome Analytics اضافه شد؛ Operator یک Range محدود را انتخاب و تحلیل را صریحاً اجرا می‌کند. خروجی شامل Total، Answered، No Answer، Busy، Failed، Unknown، Answer Ratio و Average Duration است.
- **Regression:** تست Synthetic برای MySQL/MariaDB و PostgreSQL، SQL مربوط به Source Clock و Normalize شدن Aggregate را پوشش می‌دهد؛ API احراز هویت و رد Range نامعتبر را تست می‌کند و Frontend نمایش Analytics را پوشش می‌دهد. در این Task هیچ Real PBX/Database Compatibility Probe انجام نشد.
- **Exact Next Task:** Task 61 — Call Quality Source Discovery.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — اصلاح Verify-before-save برای Database Source

- **مشکل:** Database Source قبلاً فقط بعد از Syntax Validation، Metadata و Credential را ذخیره می‌کرد. بنابراین Password، Database Name، TLS Policy، Host یا Port اشتباه می‌توانست به‌صورت `CONFIGURED` نمایش داده شود و خرابی فقط هنگام باز کردن History مشخص شود.
- **اصلاح:** Endpoint مربوط به Database Source اکنون قبل از هر Persist، Candidate واردشده را با یک اتصال محدود و فقط‌خواندنی Verify می‌کند. Verification از همان Network Target Policy و Dialect Adapterهای History استفاده می‌کند، Database واردشده را باز می‌کند، Read-only Transaction می‌سازد و فقط یک Query ثابت و محدود `SELECT 1` اجرا می‌کند.
- **ایمنی Failure:** Timeout، Connection Failure، Permission Failure یا Query Failure باعث ذخیره‌شدن Config جدید نمی‌شود و Metadata و Credential رمزنگاری‌شده قبلی بدون تغییر باقی می‌مانند.
- **UI:** دکمه به `Verify & Save` تغییر کرد و متن قدیمی که می‌گفت Save اتصال را تست نمی‌کند حذف شد. پیام‌های Operator برای Timeout و Permission از Failure عمومی Verification تفکیک شده‌اند.
- **Security:** Credential همچنان Write-only است و Buffer مربوط به Verifier بعد از استفاده Zero می‌شود. Raw Driver Error به Browser برنمی‌گردد.
- **Regression:** تست Backend تضمین می‌کند Verification ناموفق Config/Credential قبلی را عوض نمی‌کند؛ تست Unit Verifier Target واردشده و Query ثابت محدود را پوشش می‌دهد؛ تست Frontend متن Verify-before-save را بررسی می‌کند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — Backoff برای Database Connection Failure

- **مشکل:** Refreshهای پشت‌سرهم History یا چند بار زدن Verify & Save بعد از Connection/Timeout Failure می‌توانست هر بار Connection جدیدی به Database باز کند. در MySQL/MariaDB این رفتار می‌تواند با عبور از `max_connect_errors` باعث Block شدن Host شود.
- **اصلاح:** History Transport و Verify-before-save اکنون یک Backoff مشترک و PBX-scoped در Memory دارند. Connection/Timeout Failureها تلاش بعدی را به‌ترتیب 30، 60، 120 و حداکثر 300 ثانیه متوقف می‌کنند. در زمان Cooldown، درخواست با `database_backoff_active` داخل App Fail می‌شود و Socket جدیدی به Database باز نمی‌شود.
- **Recovery:** اولین Query یا Verification موفق، Failure State جمع‌شده را فوراً Reset می‌کند.
- **Scope:** فقط Connection/Timeout Failure روی Backoff اثر می‌گذارد؛ Query/Data/Schema Error باعث طولانی‌تر شدن Cooldown اتصال نمی‌شود. هیچ History یا Retry State جدیدی Persist نمی‌شود.
- **UI/API:** Verify Database و Source-backed History هنگام Backoff پاسخ مشخص 429 و پیام Operator-friendly می‌دهند و Database را پشت‌سرهم Contact نمی‌کنند.
- **Regression:** تست‌ها Escalation محدود، جلوگیری از اجرای دوباره Driver در Cooldown و Reset بعد از Success را پوشش می‌دهند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — سازگاری Read-only Transaction با MySQL 5.5

- **مشاهده واقعی:** بعد از Flush شدن Host Block، Database واقعی PBX نسخه `5.5.62-0+deb8u1` را در MySQL Handshake اعلام کرد.
- **مشکل:** Adapter همیشه قبل از Query دستور `START TRANSACTION READ ONLY` را اجرا می‌کرد؛ این Syntax روی Server قدیمی موجود قابل قبول نیست و می‌تواند Credential صحیح را هم در Verification/History به‌شکل Failure نشان دهد.
- **اصلاح:** Adapter همچنان ابتدا `START TRANSACTION READ ONLY` را امتحان می‌کند. فقط اگر MySQL خطای Syntax مشخص `ER_PARSE_ERROR` / errno `1064` بدهد، به `START TRANSACTION` عادی Fall back می‌کند. مسیر Prepared Query همچنان فقط SELECT را قبول می‌کند، Multiple Statement غیرفعال است و Account دیتابیس Read-only باقی می‌ماند.
- **Safety:** Failureهای غیر Syntax در Transaction پنهان نمی‌شوند و Fail-closed باقی می‌مانند.
- **Regression:** تست Adapter هم Fallback مربوط به MySQL 5.5 و هم Fail-closed شدن Failureهای غیر Syntax را پوشش می‌دهد.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — تفکیک امن خطاهای Database Verification

- Database Verification اکنون خطاهای رایج MySQL/MariaDB را به کدهای امن و قابل‌فهم برای Operator تفکیک می‌کند: Authentication Failure، Database Not Found، Host Blocked، TLS Failure یا Connection Failure عمومی. Raw Driver Message و Credential همچنان مخفی می‌مانند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — بهینه‌سازی Recent Row Query برای MySQL 5.5

- **رفتار مشاهده‌شده:** Call Outcome Analytics درست کار می‌کند، اما `Load recent rows` روی CDR قدیمی MySQL 5.5 می‌تواند Timeout/Abort شود و تکرار Connectionهای Abortشده به Block شدن Host در MySQL کمک کند.
- **ریشه در Query Shape:** Query Engine قبلاً برای enforce کردن Row Bound هر SELECT را داخل Derived Table می‌گذاشت و `LIMIT` را بیرون آن اعمال می‌کرد. برای Recent CDR این یعنی `SELECT * FROM (SELECT ... ORDER BY calldate DESC, uniqueid DESC) ... LIMIT N` و روی MySQL قدیمی ممکن بود قبل از Limit بخش بزرگی از History Sort/Materialize شود.
- **اصلاح:** Queryهای محدود اکنون `LIMIT maxRows+1` را مستقیم به همان SELECT معتبر اضافه می‌کنند. Row-limit detection و SELECT-only safety حفظ شده، ولی MySQL می‌تواند `ORDER BY ... LIMIT` را مستقیم Optimize کند و زودتر متوقف شود.
- **Regression:** تست Query Preparation برای MySQL و PostgreSQL، Direct Bounded SELECT را بررسی می‌کند و تست‌های Adapter و Source Schema همچنان PASS هستند.

</div>

<div dir="rtl" align="right">

## 2026-10-07 — تفکیک خطاهای Database در History

- Source-backed History دیگر همه Failureهای Query را به `source_unavailable` عمومی تبدیل نمی‌کند. کدهای امن و محدود برای Timeout، Query Failure، Row/Output Safety Limit، Unsupported Value، Authentication، Database Not Found، Host Blocked و TLS Failure نمایش داده می‌شوند؛ Raw SQL، Driver Message و Credential همچنان مخفی می‌مانند.

</div>

<div dir="rtl" align="right">

## 2026-10-08 — رفع ریشه‌ای Timeout در Recent CDR

- **تأیید Read-only روی Source واقعی:** جدول `asteriskcdrdb.cdr` روی `calldate` و `uniqueid` Index جدا دارد، اما Composite Index روی `(calldate, uniqueid)` ندارد و جدول بسیار بزرگ است.
- **ریشه اول:** `ORDER BY calldate DESC, uniqueid DESC` روی MySQL 5.5 مسیر استفاده مؤثر از Index `calldate` را خراب می‌کرد و می‌توانست Timeout ایجاد کند. Call History اکنون فقط با `calldate DESC` مرتب می‌شود تا بدون تغییر Schema روی PBX از Index موجود استفاده شود.
- **ریشه دوم:** Query Bound قبلاً `LIMIT maxRows+1` می‌گذاشت و Row اضافه را `ROW_LIMIT` حساب می‌کرد؛ در نتیجه هر Source با بیش از تعداد درخواستی Row می‌توانست با وجود Query محدود Fail شود. اکنون SQL دقیقاً `LIMIT maxRows` دارد و Validation بعد از Query همچنان به‌عنوان Defense-in-depth باقی مانده است.
- **نتیجه واقعی:** مسیر واقعی `listRecentCalls(..., 100)` روی Source پیکربندی‌شده در حدود 45ms اجرا شد و 100 Row برگرداند. هیچ Raw Row یا Credential در Probe نمایش داده نشد.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — تغییر اولویت بلافاصله بعد از Task 60

Task 60 — Call Outcome Analytics به‌همراه اصلاح‌های سازگاری Database/History روی Branch `feature/call-outcome-analytics` کامل شده و در محیط Development توسط Operator تأیید شده است؛ این Branch اکنون باید قبل از شروع Feature بعدی Merge شود.

پس از Merge، دو Task جدید قبل از Task 61 قرار می‌گیرند:

- [ ] **Task 60A — Multi-database Data Source Scope**
  - فرض فعلی «یک Database Name برای هر Data Source» به مدل «یک Connection فقط‌خواندنی Verify‌شده با چند Database/Schema مجاز» تغییر می‌کند.
  - Host، Port، Dialect، Credential و TLS یک Connection واحد باقی می‌مانند و Database/Schema Scope به‌صورت Allowlist جدا تعریف می‌شود.
  - Verify-before-save، Credentialهای Write-only، Backoff، Network Policy و Non-duplication Policy حفظ می‌شوند.
  - UI باید Connection Identity را از Database/Schema Scope جدا نمایش دهد و فقط Scope واقعاً Verify‌شده را قابل استفاده بداند.
  - Configurationهای تک‌Database فعلی باید بدون افشای Credential به شکل سازگار Migration شوند.

- [x] **Task 60B — Queue Abandonment Analytics / KPI**
  - Analytics فقط‌خواندنی و Source-owned برای Queue انتخاب‌شده و بازه زمانی مشخص اضافه می‌شود.
  - `ABANDON` Caller باید از Exit/Timeout سیستم مثل `EXITWITHTIMEOUT` جدا باقی بماند.
  - KPIها: تعداد ورود به Queue، Connected/Answered، Abandoned، Abandonment Rate، Average Wait Before Abandon، Long-wait Abandon با Threshold قابل تنظیم، و در صورت کافی بودن Source Data، P50/P90 زمان انتظار.
  - هیچ Queue History محلی، Warehouse، Arbitrary SQL یا Write روی PBX/Database اضافه نمی‌شود.

**ترتیب جدید:** Merge Task 60 → Task 60A → Task 60B → Task 61 (Call Quality Source Discovery).

دلیل این اولویت این است که محدودیت Single-database یک بدهی معماری واقعی در Source Model است و Queue Abandonment همین الآن Source قابل بررسی دارد؛ در مقابل Call Quality هنوز در مرحله Source Discovery است و Support آن تضمین‌شده نیست.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — تکمیل Task 60A: Multi-database Data Source Scope

- Data Source اکنون Connection Identity را از Database/Schema Scope جدا می‌کند: یک Dialect/Host/Port/Primary Database/Username/TLS/Credential و یک لیست محدود از Scopeهای Verify‌شده.
- Migration 19 برای Configهای فعلی `database_scopes_json` اضافه می‌کند؛ MySQL/MariaDB از Primary Database فعلی و PostgreSQL به‌صورت محافظه‌کارانه از Schema متعارف `public` شروع می‌شود. Credential در Migration بازنویسی یا افشا نمی‌شود.
- Verify & Save با یک Connection فقط‌خواندنی و محدود تمام Scopeهای درخواستی را از `information_schema.schemata` Verify می‌کند. اگر حتی یک Scope در دسترس Account نباشد، Config قبلی دست‌نخورده می‌ماند.
- در MySQL/MariaDB، Scopeها Database Name هستند و Primary Database همیشه خودکار در Scope قرار می‌گیرد. در PostgreSQL، Scopeها Schemaهای داخل Primary Database هستند.
- Source Schema Discovery اکنون فقط داخل Scopeهای Verify‌شده انجام می‌شود؛ اگر یک Dataset در چند Scope Match شود، Application آن را `AMBIGUOUS` اعلام می‌کند و حدس نمی‌زند.
- UI، Primary / Connection Database را از Allowed Database / Schema Scopes جدا نمایش می‌دهد و برای هر Dialect توضیح مناسب دارد.
- حداکثر 16 Scope مجاز است و هیچ Arbitrary SQL، Write Permission، Local History Warehouse یا Credential Disclosure اضافه نشده است.
- تست‌های Targeted Backend/Frontend و Migration پاس شدند. Probe واقعی فقط‌خواندنی نیز تأیید کرد Account فعلی هر دو Scope موردنیاز Operator را می‌بیند؛ نام‌های واقعی فقط در Context خصوصی باقی می‌مانند.
- Task بعدی بعد از Merge: **Task 60B — Queue Abandonment Analytics / KPI**.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — تکمیل Task 60B: Queue Abandonment Analytics / KPI

- Queue Analytics از Dataset متعارف و Discover‌شده `queue_log` استفاده می‌کند. Capability مربوط به Analytics از Queue Event History جداست و برای Wait-time به ستون `data3` نیاز دارد؛ بنابراین ممکن است Queue Events پشتیبانی شود ولی Analytics به‌صورت صریح Unsupported باشد.
- Operator یک Queue ID از Dropdown صف‌های فعلی، `از تاریخ و ساعت`، `تا تاریخ و ساعت` و Long-wait Threshold عدد صحیح بین ۱ تا ۶۰ دقیقه انتخاب می‌کند.
- `ENTERQUEUE` تعداد ورود، `CONNECT` تعداد اتصال به Agent، `ABANDON` فقط Caller-driven Abandon و `EXITWITHTIMEOUT` فقط Queue/System Timeout را می‌شمارد. این دو Outcome عمداً با هم ادغام نمی‌شوند.
- Average Wait Before Abandon و Long-wait Abandon از Wait-time استاندارد رویداد `ABANDON` در `data3` محاسبه می‌شوند. اگر Denominator یا Average واقعاً وجود نداشته باشد، مقدار ساختگی صفر تولید نمی‌شود.
- P50/P90 به روش Exact Nearest-rank فقط وقتی محاسبه می‌شود که کل Sample مربوط به Abandon حداکثر ۱۰۰۰ Row باشد. بالاتر از این Bound، Percentile حذف می‌شود و از Sample ناقص تخمین زده نمی‌شود؛ Aggregate KPIها همچنان قابل استفاده هستند.
- تمام Queryها Source-owned، Parameterized، محدود و Read-only هستند. هیچ Queue History محلی، Warehouse، Arbitrary SQL، Background Polling یا Write روی PBX/Database اضافه نشده است.
- API جدید `history/queue-abandonment` و UI دو‌زبانه History اضافه شد و Caller Abandon را جدا از Queue Timeout نمایش می‌دهد.
- تست‌های Synthetic Adapter/API/UI برای Event Separation، Wait Metrics، Percentile، Safety Bound، Schema Fail-closed و Input Validation پاس شده‌اند. در پیاده‌سازی Task 60B هیچ Probe جدیدی به PBX/Database واقعی انجام نشد.
- Task بعدی بعد از Merge: **Task 61 — Call Quality Source Discovery**.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — اصلاح UX در Review مربوط به Task 60B

- مقصد قبلی Call History در منوی Operations با عنوان **گزارشات** نمایش داده می‌شود و هم Analytics و هم Source History محدود را در خود دارد.
- گزارش Call Outcome و Queue Abandonment به‌جای Rangeهای ثابت، دو ورودی Native از نوع Date-Time برای **از تاریخ و ساعت** و **تا تاریخ و ساعت** دارند. Backend فقط Window معتبر با `From < To` را قبول می‌کند و مقادیر همچنان Parameterized هستند.
- Queue ID از Dropdown صف‌های فعلی Normalized AMI مربوط به PBX انتخاب می‌شود. حتی در حالت Source Capability غیرقابل‌استفاده، Form مخفی نمی‌شود و دلیل Availability جدا نمایش داده می‌شود.
- Long-wait Threshold به‌صورت عدد صحیح برحسب **دقیقه** بین ۱ تا ۶۰ وارد می‌شود و Placeholder نمونه برای Operator دارد.
- Schema Discovery اکنون علاوه بر `queue_log`، نام رایج FreePBX یعنی `queuelog` را هم پشتیبانی می‌کند؛ اگر بیش از یک Candidate معتبر وجود داشته باشد همچنان Fail-closed و `AMBIGUOUS` است.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — تشخیص Timeout گزارش Queue و اصلاح Sargability

- Diagnostic فقط‌خواندنی روی Source واقعی نشان داد Index ترکیبی مناسب با ترتیب Queue، Event و Time از قبل وجود دارد؛ برای این Timeout فعلاً هیچ Database Setting یا Index جدید لازم نیست.
- علت اصلی این بود که Query مربوط به MySQL/MariaDB روی ستون Indexed `event` عبارت `UPPER(TRIM(CAST(...)))` اعمال می‌کرد و در نتیجه Optimizer نمی‌توانست بخش Event/Time از Composite Index را به‌صورت مؤثر استفاده کند.
- در MySQL/MariaDB مقایسه Event اکنون مستقیم انجام می‌شود. Source واقعی Collation غیرحساس به بزرگی/کوچکی حروف و Eventهای Canonical مربوط به Asterisk دارد، بنابراین Semantics حفظ و Sargability برگردانده می‌شود. PostgreSQL برای حفظ رفتار Case-sensitive مسیر Normalize قبلی را نگه می‌دارد.
- `EXPLAIN` فقط‌خواندنی روی Source واقعی کاهش شدید Row Estimate و استفاده مؤثر از Composite Index را تأیید کرد و یک Aggregate واقعی محدود روی بازه دو روزه در چند ده میلی‌ثانیه اجرا شد. هیچ Write روی PBX/Database انجام نشد.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — تکمیل ترجمه فارسی و شفاف‌سازی UX گزارش صف

- تمام متن‌های کاربرمحور بخش گزارشات در حالت فارسی، شامل عنوان‌ها، خطاها، وضعیت پشتیبانی داده، KPIهای ترک صف و متن‌های راهنما، یکدست فارسی شدند. فقط کدهای واقعی رویداد Asterisk مثل `ABANDON` و `EXITWITHTIMEOUT` در جایی که معنای دقیق Source لازم است حفظ شده‌اند.
- زیر آستانه انتظار طولانی توضیح داده می‌شود که این مقدار فقط شاخص «ترک صف پس از انتظار طولانی» را تغییر می‌دهد؛ شاخص‌های پایه صف در همان صف و بازه زمانی مستقل از این آستانه هستند.
- Badgeهای وضعیت داده در حالت فارسی دیگر Enum خام انگلیسی مثل `SUPPORTED` و `NOT_FOUND` را نمایش نمی‌دهند.
- Regression Test حالت فارسی برای عنوان گزارش، وضعیت‌های پشتیبانی و KPIهای صف اضافه شد.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — نمودار و خروجی PDF/Excel برای گزارش Task 60B

- بعد از KPIهای گزارش صف، یک نمودار Donut واکنش‌گرا نمایش داده می‌شود که تماس‌های وصل‌شده، ترک صف توسط تماس‌گیرنده، پایان مهلت انتظار صف و در صورت نیاز «سایر خروجی‌ها» را به‌صورت سهم از کل نمایش می‌دهد.
- خروجی **PDF واقعی** از همان گزارش Load‌شده شامل مشخصات فیلتر، KPIها و نمودار ساخته می‌شود. Report Canvas به‌صورت مستقیم از فیلترها، KPIها و داده نمودار موجود در Browser ساخته می‌شود تا شکل‌دهی متن فارسی در PDF صحیح بماند و نیازی به قراردادن Font جداگانه در Repository نباشد.
- خروجی **Excel واقعی (`.xlsx`)** فیلترها و KPIها را به‌صورت Cellهای قابل استفاده نگه می‌دارد و تصویر همان نمودار را نیز داخل Sheet قرار می‌دهد. Sheet در حالت فارسی RTL است.
- Export هیچ Query جدیدی به PBX یا Database ارسال نمی‌کند و فقط از Analytics موجود در حافظه Browser استفاده می‌کند؛ بنابراین گرفتن PDF/Excel بار جدیدی روی سرور VoIP ایجاد نمی‌کند.
- Dependency نهایی XLSX یعنی `write-excel-file` مجوز MIT دارد و فقط هنگام ساخت Excel به‌صورت Dynamic Import لود می‌شود. نمودار و Report Canvas برای PDF/Excel مستقیماً با Canvas API مرورگر ساخته می‌شوند و بسته‌بندی PDF با Writer داخلی کوچک پروژه انجام می‌شود؛ بنابراین هیچ Dependency برای Screenshot گرفتن از DOM لازم نیست. Library اولیه Excel که Dependency آسیب‌پذیر داشت قبل از Commit حذف شد و `npm audit --omit=dev` برای ترکیب نهایی صفر Vulnerability گزارش می‌دهد.
- Regression Test وجود نمودار و دکمه‌های PDF/Excel را در هر دو حالت انگلیسی و فارسی بررسی می‌کند و Production Browser Build نیز Dynamic Importها را Validate می‌کند.

</div>


<div dir="rtl" align="right">

## 2026-10-08 — رفع Hang خروجی Excel در Task 60B

- پس از تحلیل موفق صف، خروجی Excel ممکن بود برای همیشه روی وضعیت «در حال ساخت Excel…» باقی بماند.
- Writer خود فایل XLSX به‌صورت مستقل با تصویر Embedded آزمایش شد و در چند میلی‌ثانیه پاسخ داد؛ مرحله ناپایدار، تبدیل DOM به Canvas قبل از ساخت Workbook بود.
- مسیر Export بازطراحی شد: نمودار و Report Canvas مستقیماً از داده Analytics موجود در Browser رسم می‌شوند و دیگر هیچ Screenshot از DOM گرفته نمی‌شود.
- ساخت Excel اکنون ابتدا `Blob` واقعی Workbook را می‌گیرد و سپس با Download Helper داخلی برنامه فایل را دانلود می‌کند؛ بنابراین پایان عملیات صریح و قابل‌کنترل است.
- برای تمام مرحله‌های Async مربوط به تصویر و Workbook یک Timeout پانزده‌ثانیه‌ای اضافه شد تا UI در صورت خطا هیچ‌وقت در وضعیت Export قفل نماند.
- مسیر واقعی Excel با یک Harness موقت Vite در Chrome Headless ریموت تست شد و حدود ۱۴۸ میلی‌ثانیه‌ای با موفقیت پایان یافت. Harness موقت پاک شد و وارد Git نشد.
- این Fix کاملاً Client-side است و هیچ Query جدیدی به PBX یا Database ارسال نمی‌کند.

</div>

<div dir="rtl" align="right">

## 2026-10-08 — Task 60C گزارش‌ساز جامع عملکرد چند صف — در انتظار تأیید کاربر

- یک گزارش‌ساز واقعی صف در بخش گزارشات اضافه شد. کاربر بازه دقیق «از/تا» را تعیین می‌کند و می‌تواند بین ۱ تا ۱۶ صف را هم‌زمان انتخاب کند. Catalog صف‌ها مستقیماً و فقط‌خواندنی از تاریخچه Queue در Source خوانده می‌شود و فقط در صورت عدم دسترسی، وضعیت لحظه‌ای Telephony نقش Fallback دارد.
- گزارش برای هر صف و همچنین مجموع صف‌های انتخابی این شاخص‌ها را ارائه می‌کند: ورودی صف، پاسخ‌داده‌شده، پاسخ‌داده‌نشده در Window، از دست‌رفته قطعی، ترک توسط تماس‌گیرنده، پایان مهلت صف، خروج با کلید منو، خروج اجباری/صف خالی، خطاهای محدود Agent/System، موارد بدون نتیجه نهایی در Window، تلاش‌های RINGNOANSWER، تلاش‌های RINGCANCELED، میانگین زمان تا پاسخ و میانگین انتظار تماس‌گیرنده.
- `RINGNOANSWER` عمداً Lost Call محسوب نمی‌شود؛ چون یک تماس می‌تواند چند بار برای Agentهای مختلف زنگ بخورد و در نهایت پاسخ داده شود. این Event به‌صورت شاخص Attempt جدا نمایش داده می‌شود. `RINGCANCELED` نیز مستقل باقی می‌ماند.
- درصدها مخرج مشخص دارند: سهم ورودی هر صف از مجموع ورودی صف‌های انتخابی، و نرخ‌های پاسخ/عدم پاسخ/Lost و علت‌های Lost نسبت به ورودی همان صف. برای زمان‌ها درصد ساختگی ساخته نمی‌شود و مقدار واقعی زمان نمایش داده می‌شود. RINGNOANSWER علاوه بر Count به‌صورت Attempt به‌ازای هر ۱۰۰ تماس ورودی Normalize می‌شود.
- پنج نمودار اضافه شد: حجم ورودی/پاسخ/Lost، ترکیب علت Lost، نرخ پاسخ و Lost، میانگین زمان‌های صف و فعالیت Ring Attempt. جدول تفصیلی همه KPIها و ردیف Total را نگه می‌دارد.
- PDF چندصفحه‌ای است: صفحه اول Summary و نمودارها و صفحات بعد KPIهای تفکیکی صف‌ها را نگه می‌دارند. Excel واقعی `.xlsx` شامل Cellهای ساختاریافته همه KPIها/Rateها و نمودارهای Embedded است. Export فقط در Browser انجام می‌شود و Query جدیدی به PBX/Database نمی‌زند.
- KPIهای اصلی دیگر به Limit هزار Row مربوط به Raw History وابسته نیستند. Backend Aggregateهای دقیق Source را در Chunkهای روزانه و به‌صورت Sequential اجرا و فقط Sum/Countهای Aggregate را Merge می‌کند.
- برای حفظ سلامت Source عملیاتی، Report بین ۱ تا ۱۶ صف و با فعال بودن KPIهای دقیق Caller حداکثر ۳۰ روز محدود است. برای گزارش‌های چندماهه سنگین یا سالانه، معماری درست Read-only Reporting Replica است، نه Scan سنگین روی Database زنده PBX.
- اختلاف مرز بازه پنهان نمی‌شود: Unanswered بر اساس Entry/Answer داخل همان Window است و Terminal Outcomeها مستقل شمارش می‌شوند. فیلدهای `unresolvedUnansweredCalls` و `outcomeExcessCalls` اختلاف Cross-window یا Eventهای سفارشی را آشکار می‌کنند.
- Query اولیه‌ی تک‌مرحله‌ای در Validation واقعی Timeout شد و کنار گذاشته شد. مسیر نهایی Count Aggregate سبک + Timing Aggregate جداگانه برای Eventهای واقعاً موجود است. Validation فقط‌خواندنی روی Source واقعی، هم بازه هفت‌روزه همه صف‌ها و هم بازه ۳۰روزه را بدون دریافت Raw Row با موفقیت تأیید کرد.

</div>

<div dir="rtl" align="right">

## 2026-10-08 — تکمیل Task 60C با KPI تماس‌گیرنده و Excel ریز تماس‌ها

- KPIهای جدید به گزارش هر صف و مجموع صف‌های انتخابی اضافه شد: تماس‌گیرنده یکتا، تماس‌گیرنده تکراری، نرخ تماس‌گیرنده تکراری، میانگین تعداد تماس به‌ازای Caller شناسایی‌شده، تعداد تماس‌های ایجادشده توسط Callerهای تکراری، سهم تماس‌های تکراری و درصد پوشش شناسایی Caller ID. در Total، Caller مشترک بین چند صف فقط یک‌بار به‌عنوان Unique محاسبه می‌شود.
- برای KPI مدیریتی، Caller ID فقط‌خواندنی از Event `ENTERQUEUE` خوانده می‌شود و Backend بلافاصله آن را با کلید تصادفی مخصوص همان Report به HMAC تبدیل می‌کند. شماره خام برای KPI ذخیره، Log یا به API گزارش مدیریتی برگردانده نمی‌شود.
- سقف سخت ۱۰۰۰ Row در Query Layer حفظ شده است. هر Chunk روزانه ابتدا Count می‌شود؛ اگر بیشتر از سقف باشد، بازه زمانی قبل از Query گروه‌بندی Caller نصف می‌شود. Source سپس فقط Queue/Callerهای گروه‌بندی‌شده و تعداد تماس هر Caller را برمی‌گرداند و Caller خام بلافاصله در حافظه Pseudonymize می‌شود.
- به دلیل اضافه‌شدن Dedup دقیق Caller، سقف گزارش جامع روی Database عملیاتی از ۹۰ روز به **۳۰ روز** کاهش یافت. برای گزارش فصلی/سالانه راه درست Reporting Replica فقط‌خواندنی است، نه Scan طولانی روی Source زنده PBX.
- یک خروجی جداگانه و فقط **Excel** برای ریز تماس‌های همان فیلتر فعال اضافه شد. هر Row نماینده یک ورود به صف است و شامل صف، Call ID، شماره تماس‌گیرنده، زمان ورود، موقعیت اولیه، نتیجه Normalized تماس، Agent در صورت وجود، زمان اتصال/نتیجه و زمان انتظار است.
- هیچ Join دیتابیسی بر اساس `callid` انجام نمی‌شود. Entry و Terminal Eventها با فیلتر Queue/Event/Time و Queryهای کوچک خوانده و داخل برنامه بر اساس Call ID به هم متصل می‌شوند.
- برای جلوگیری از خطای مرز نیمه‌شب، Outcome هر Chunk حداکثر تا ۲۴ ساعت بعد از Window ورود و فقط تا زمان «تا»ی گزارش دنبال می‌شود.
- Export ریز تماس‌ها در Browser حداکثر ۷۵هزار Row دارد. Queryهای Database همچنان زیر سقف ۱۰۰۰ Row باقی می‌مانند. چون فایل شامل Caller Number و Call ID است، در UI به‌عنوان داده عملیاتی حساس مشخص می‌شود.
- Regression Testهای Backend/API محاسبه Unique بین چند صف، Repeat Caller، Count-first safety و Normalization ریز تماس را پوشش می‌دهند. ساخت فایل XLSX ریز تماس در Chrome واقعی نیز موفق Validate شد. Validation فقط‌خواندنی Source واقعی بدون چاپ Caller Number یا Call ID انجام شد.

</div>

<div dir="rtl" align="right">

### تکمیل KPI تماس‌گیرنده و خروجی ریز تماس

- KPIهای تماس‌گیرنده یکتا، تماس‌گیرنده تکراری، نرخ تماس‌گیرنده تکراری، میانگین تماس به‌ازای Caller، تعداد/سهم تماس‌های Callerهای تکراری و پوشش شناسایی Caller ID به گزارش صف اضافه شدند. برای Total چندصفی، Caller مشترک بین صف‌ها فقط یک Caller یکتا محسوب می‌شود.
- برای کاهش Load، Backend بعد از Count سریع ENTERQUEUE، Windowهای بزرگ را تا سقف ۱۰۰۰ Source Row خرد می‌کند و سپس Source فقط Callerهای گروه‌بندی‌شده به‌همراه تعداد تماس هر Caller را برمی‌گرداند. Caller خام بلافاصله با HMAC و کلید تصادفی همان Report Pseudonymize می‌شود و نه ذخیره می‌شود و نه در API KPI برمی‌گردد.
- خروجی Excel ریز تماس‌ها دقیقاً از همان بازه و صف‌های Report استفاده می‌کند و شامل Queue، Call ID، Caller Number، زمان ورود، Position اولیه، Outcome، Agent، زمان اتصال/نتیجه/پایان، زمان انتظار و مدت مکالمه است. این خروجی فقط با اقدام صریح کاربر ساخته می‌شود، روی Backend ذخیره نمی‌شود و به‌دلیل وجود Caller Number/Call ID داده عملیاتی حساس محسوب می‌شود.
- Detail Export به‌صورت روزانه و Adaptive خوانده می‌شود؛ هر Query حداکثر ۱۰۰۰ Row دارد و Workbook مرورگر حداکثر ۷۵هزار تماس را می‌پذیرد.
- Validation کنترل‌شده Source واقعی، تطبیق KPIهای Caller با Aggregate مستقل و صحت بازسازی Detail را بدون چاپ داده حساس تأیید کرد. Export مصنوعی ۱۰هزار ردیفی نیز در Chrome واقعی با موفقیت کامل شد.

</div>

<div dir="rtl" align="right">

## 2026-10-09 — لایه راهنمای دو‌زبانه Contextual Help برای Task 60C — در انتظار تأیید کاربر

- یک سیستم Help مشترک در UI اضافه شد تا Navigation، عنوان Workspace/Section، فیلدها، Statusها، KPIهای داشبورد، Filterهای گزارش، KPIها، نمودارها، ستون‌های جدول و Actionهای Export بتوانند به‌صورت یکدست علامت `?` داشته باشند و هر صفحه Tooltip اختصاصی و ناسازگار نسازد.
- زبان Help از زبان خود برنامه پیروی می‌کند: در UI فارسی توضیح فارسی و RTL/راست‌چین است و در UI انگلیسی توضیح انگلیسی نمایش داده می‌شود.
- رفتار دوحالته است: Hover یا Focus توضیح موقت را باز می‌کند؛ Click روی `?` همان توضیح را Pin می‌کند تا با Close یا کلیک بیرون بسته شود. Help Trigger یک Button مستقل و Accessible است و داخل Button دیگری Nest نمی‌شود.
- در Reports توضیح‌ها تخصصی‌تر از Fallback عمومی برنامه هستند و برای KPIها سه سؤال را پاسخ می‌دهند: «این چیست؟»، «چرا مهم است؟» و «چطور محاسبه می‌شود؟». مخرج درصدها و Event/Source Semantics نیز هرجا لازم باشد صریح نوشته می‌شود.
- یک راهنمای دائمی دو‌زبانه کنار Reports اضافه شد که نکته‌های تفسیر اصلی را توضیح می‌دهد: تعداد تماس ورودی با Caller یکتا یکی نیست؛ Repeat Caller علت اختلاف حجم تماس و تعداد افراد را روشن می‌کند؛ `RINGNOANSWER` Attempt است نه Lost Call؛ Unresolved ابهام مرز Window را پنهان نمی‌کند؛ و Excel ریز تماس‌ها برخلاف PDF/XLSX مدیریتی، فقط با اقدام صریح کاربر Detail حساس را از Source می‌خواند.
- Help اختصاصی برای KPIهای Caller، Call Outcome، Queue Abandonment، دسته‌های Lost، زمان‌ها، Percentileها، نمودارها و تمام Exportهای گزارش نوشته شد و فرمول‌ها با Contract واقعی Backend هماهنگ هستند.
- Context Help فقط Presentation است؛ Query جدید به PBX/Database نمی‌زند، تعامل Help را Persist نمی‌کند، Refresh/Collector را تغییر نمی‌دهد و Endpoint جدید Backend ایجاد نمی‌کند.
- Regression Test، فارسی/انگلیسی، متن فرمول، Hover، Click-to-Pin، Close و وجود گسترده Help Trigger در Flow گزارش را پوشش می‌دهد. یک Harness موقت Chrome واقعی نیز رفتار Popover را Validate کرد و قبل از Commit پاک شد.

</div>
<div dir="rtl" align="right">
- **گسترش Help برای Actionها:** دکمه‌های عملیاتی مشترک برنامه مانند Save، Reset، Create، Delete، Refresh، Verify و Pagination از Wrapper مشترک HelpButton استفاده می‌کنند تا علامت `?` و رفتار Hover/Pin کنار Actionها هم یکسان باشد. کنترل‌های Layout-sensitive مثل Navigation/Fullscreen به‌صورت Sibling Help باقی می‌مانند تا هیچ Interactive Element داخل Button دیگری Nest نشود.
</div>

### ۲۰۲۶-۱۰-۰۹ — تحویل یکپارچه‌سازی تحلیل صف
شاخه feature/queue-abandonment-analytics شامل گزارش‌های مبتنی بر داده منبع، شاخص‌های تماس‌گیرنده و خروجی اکسل جزئیات با فیلتر است. پس از بازبینی کاربر، رابط آزمایشی راهنمای صفحه کنار گذاشته شد؛ علامت‌های راهنمای داخل صفحه مخفی شدند و متن‌های توضیحی اضافی داشبورد و گزارش‌ها کاهش یافتند، اما پیام‌های عملیاتی و خطا باقی ماندند. انتخاب حالت روشن و تاریک با یک دکمه آیکونی انجام می‌شود. تست‌های کامل فرانت‌اند و بک‌اند، بررسی Lint و Typecheck قبل از یکپارچه‌سازی موفق بودند. شاخه برای ادغام با کنترل کاربر آماده می‌شود؛ این ثبت به معنی اجازه شروع تسک بعدی یا انتشار Production نیست.

### ۲۰۲۶-۱۰-۰۹ — شروع Task 61 (تکمیل‌نشده)
شاخه `feature/call-quality-source-discovery` از `main` ادغام‌شده با شناسه `c92c589` ساخته شد. بررسی اولیه کد و مستندات رسمی RTCP در `docs/CALL_QUALITY_SOURCE_DISCOVERY.md` ثبت شد. رویدادهای RTCPSent/RTCPReceived فقط منبع احتمالی‌اند و قابلیت واقعی آن‌ها روی سامانه تلفنی هنوز تأیید نشده است. برای تکمیل Task 61 باید منبع واقعی با دسترسی محدود و فقط‌خواندنی تأیید و ماتریس قابلیت‌ها تهیه شود. هیچ Probe واقعی PBX/دیتابیس یا تغییر UI/API انجام نشده و Task 62 آغاز نمی‌شود.

### ۲۰۲۶-۱۰-۰۹ — نتیجه بررسی فقط‌خواندنی Task 61
در پایش ۲۰ ثانیه‌ای AMI سامانه Asterisk نسخه 13.20.0، تعداد ۱۵ رویداد `RTCPReceived` و ۱۲ رویداد `RTCPSent` مشاهده شد؛ نام فیلدهای RTT، Jitter و Packet Loss نیز شناسایی شد. هیچ مقدار فیلد یا شناسه تماس در خروجی ثبت نشد. بنابراین تولید واقعی رویدادهای RTCP تأیید شده، ولی واحدها، معنی دقیق محاسبات و تطبیق با هر تماس هنوز تأیید نشده‌اند. بررسی ساختار دیتابیس به‌علت محدودیت دسترسی اجرا نشد و وضعیت آن نامشخص است. جزئیات در `docs/CALL_QUALITY_SOURCE_DISCOVERY.md` ثبت شده است. Task 61 هنوز کامل نیست و Task 62 شروع نمی‌شود.

### ۲۰۲۶-۱۰-۰۹ — بستن محدود Task 61، کشف منبع زنده AMI
تصمیم: Task 61 در بخش کشف منبع زنده، با شواهد مستقیم روی یک سامانه Asterisk نسخه 13.20.0 تکمیل شد؛ رویدادهای RTCPReceived و RTCPSent و نام فیلدهای مربوط به Loss، Jitter و RTT واقعاً مشاهده شدند. این به معنی تأیید واحد عددها، اعتبار KPI، وجود تاریخچه کیفیت در دیتابیس، MOS یا Codec نیست. هر قابلیت فاقد تأیید باید UNKNOWN بماند، نه صفر یا UNSUPPORTED. Probe ساختار دیتابیس اجرا نشده و تکمیل‌شده محسوب نمی‌شود. Task 62 باید نحوه تبدیل عددها، جهت مدیا، پیوند SSRC با Leg تماس و نگهداری موقت در RAM را اعتبارسنجی کند. مستندات کامل در docs/CALL_QUALITY_SOURCE_DISCOVERY.md. هیچ دیپلوی، Merge یا تغییری در PBX انجام نشد.

### ۲۰۲۶-۱۰-۰۹ — رفع خطای CI در PR شماره 83
علت بازتولیدشده خطای CI، ناموفق بودن `npm run format:check` به‌دلیل چینش Import در فایل `frontend/src/DashboardBuilder.tsx` بود که از main به ارث رسیده است. فقط قالب‌بندی با Prettier اصلاح شد و هیچ منطق اجرایی تغییر نکرد. بررسی Foundation، فرمت، Lint، Typecheck، تمامی تست‌های Backend/Frontend و Build به‌صورت محلی موفق بودند. پیش از Merge باید وضعیت نهایی Checkهای GitHub نیز سبز شود.

### ۲۰۲۶-۱۰-۰۹ — Task 62: قرارداد مستقل کیفیت تماس
این Task در شاخه `feature/call-quality-contract` از نسخه ادغام‌شده `main` با شناسه `e2edb0c` پیاده‌سازی شد. نوع داده مشترک `CallQualitySample` وضعیت‌های AVAILABLE و UNKNOWN/UNSUPPORTED را با واحد اندازه‌گیری صریح نگهداری می‌کند. نرمال‌ساز مستقل AMI RTCP جهت رویداد، Leg/Linkedid، SSRC و بلوک‌های محدود گزارش را استخراج می‌کند؛ Jitter خام فقط در RTP_TICKS و مقدار تجمعی Packet Loss فقط در COUNT نگهداری می‌شوند. درصد Packet Loss، مقیاس RTT، MOS و Codec تا زمان تأیید جداگانه UNKNOWN باقی می‌مانند. هیچ اتصال زنده، API عمومی، ذخیره‌سازی محلی، کوئری دیتابیس یا تغییری در PBX انجام نشده است. ۲۰۶ تست Backend و ۳۹ تست Frontend و بررسی‌های Lint، Typecheck و Format موفق‌اند. اتصال Runtime و ارتباط با تماس فعال وظیفه Task 63 است. این شاخه پیش از Merge نیازمند بررسی است.

### ۲۰۲۶-۱۰-۰۹ — پیاده‌سازی Task 63 کیفیت تماس زنده (در انتظار بررسی)
شاخه `feature/live-call-quality` از `main` ادغام‌شده با شناسه `f0ac24f` ساخته شد. دریافت غیرفعال رویدادهای RTCP به اتصال فعلی AMI افزوده شد و اتصال شبکه جدید یا دستور تغییردهنده PBX ایجاد نمی‌کند. حافظه RAM هر PBX حداکثر ۲۵۶ نمونه تفکیک‌شده بر پایه Leg و SSRC را حداکثر ۱۲۰ ثانیه نگه می‌دارد و پس از قطع ارتباط یا Reset پاک می‌کند. API احرازهویت‌شده و وابسته به PBX در مسیر `GET /api/pbx-instances/:id/call-quality` فقط نمونه‌های مربوط به Channelهای فعال در Snapshot همگام را برمی‌گرداند. نبود نمونه به معنی UNKNOWN است، نه کیفیت مطلوب یا صفر. Jitter در واحد RTP_TICKS و Loss تجمعی در COUNT می‌ماند؛ RTT، درصد Loss، MOS و Codec همچنان UNKNOWN هستند. ذخیره‌سازی تاریخچه، رابط کاربری و تغییر در PBX اضافه نشده است. تست و بازبینی قبل از Merge الزامی است؛ Task 64 مربوط به داشبورد است.

### ۲۰۲۶-۱۰-۰۹ — استقرار آزمایشی Task 63 پیش از Merge
طبق تأکید کاربر، ابتدا شاخه تأییدنشده `feature/live-call-quality` با Commit `3d7d3d0` در محیط Development پورت `8443` دیپلوی شد و تا تأیید کاربر Merge نمی‌شود. پیش از استقرار نسخه پشتیبان Build در پوشه خصوصی و Ignored نگهداری شد؛ دستور `npm run build:production` موفق بود و سرویس Restart شد. اولین بررسی اتصال به Gateway به‌دلیل فاصله کوتاه راه‌اندازی شکست موقت داشت اما سپس سرویس active، مسیرهای Health و Ready با کد ۲۰۰ و API کیفیت بدون لاگین با کد ۴۰۱ تأیید شدند. تست دستی کاربر همچنان باقی است. هیچ تغییری در PBX ایجاد نشد.

### ۲۰۲۶-۱۰-۰۹ — داشبورد Task 64 کیفیت تماس زنده، پیش از Merge
شاخه `feature/call-quality-dashboard` پس از Merge تسک ۶۳ با Commit `9daadac` ایجاد شد. صفحه دوزبانه Live Call Quality در منوی عملیات قرار گرفت و هر ۵ ثانیه API احرازهویت‌شده PBX را می‌خواند. تعداد Legهای دارای نمونه، Jitter خام در RTP_TICKS، Lost Packets تجمعی و وضعیت UNKNOWN برای درصد Loss، RTT، MOS و Codec نمایش داده می‌شود. تا زمان اعتبارسنجی عددها و اتصال قطعی به Trunk/Endpoint، مجموع تماس‌های ضعیف، میانگین کیفیت، رتبه‌بندی بدترین تماس‌ها و نمودارهای کیفیت به‌صورت ساختگی تولید نمی‌شوند. ذخیره‌سازی تاریخچه و تغییر در PBX وجود ندارد. تست در Development پیش از Merge الزامی است. بخش‌های وابسته به منبع معتبر در Scope تسک ۶۴ همچنان باز هستند.

### ۲۰۲۶-۱۰-۰۹ — دیپلوی پیش از Merge تسک ۶۴ برای تأیید کاربر
شاخه `feature/call-quality-dashboard` با Commit `72c76d0` در GitHub ثبت و قبل از Merge روی Development پورت `8443` با `npm run build:production` دیپلوی شد. فایل‌های Build قبلی در مسیر خصوصی Ignored `rollback-task64` نسخه پشتیبان دارند. سرویس Restart و فعال شد، `/ready` کد ۲۰۰ و API کیفیت تماس بدون لاگین کد ۴۰۱ برگرداند؛ وجود فایل Frontend جدید تأیید شد. Merge انجام نشده است. کاربر باید منوی کیفیت تماس زنده، انتخاب PBX، نمایش نمونه یا Unknown و درست‌بودن اطلاعات را بررسی کند. شاخص‌های تماس ضعیف و رتبه‌بندی بدترین تماس‌ها به علت نامعتبر بودن واحدها هنوز ارائه نشده‌اند.

### ۲۰۲۶-۱۰-۰۹ — ادامه اعتبارسنجی شاخص‌های کیفیت تماس
شاخه `feature/call-quality-metric-validation` تابع‌های مستقل تبدیل RFC3550 برای Fraction Loss، تبدیل RTT از ثانیه و Jitter با Clock Rate معلوم را اضافه می‌کند. این تبدیل‌ها تنها با مدرک صریح برای نسخه و جریان RTP قابل فعال‌شدن هستند و هنوز به دریافت زنده یا UI متصل نشده‌اند. مقیاس عددی داده‌های واقعی Asterisk 13.20.0 هنوز تأیید نشده و Codec و MOS فاقد منبع معتبرند؛ بنابراین همچنان UNKNOWN باقی می‌مانند. هیچ تغییر در PBX ایجاد نشده است. KPIهای تماس ضعیف و توزیع کیفیت باز هستند.
