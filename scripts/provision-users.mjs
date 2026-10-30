import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const configPath = path.resolve(process.cwd(), 'provision-users.json');
const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

function fail(message) {
  console.error(`\nخطا: ${message}\n`);
  process.exit(1);
}

if (!supabaseUrl || !secretKey) {
  fail('مقادیر SUPABASE_URL و یکی از SUPABASE_SECRET_KEY یا SUPABASE_SERVICE_ROLE_KEY در فایل .env.provision تنظیم نشده‌اند.');
}
if (!fs.existsSync(configPath)) {
  fail('فایل provision-users.json وجود ندارد. ابتدا provision-users.example.json را کپی و اطلاعات واقعی را در آن وارد کنید.');
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
  fail('ساختار فایل provision-users.json معتبر نیست.');
}

const users = config.users;
if (!config.organizationName || !/^[a-z0-9-]{3,60}$/.test(config.organizationSlug || '')) {
  fail('نام شرکت یا شناسه لاتین شرکت (organizationSlug) معتبر نیست.');
}
if (!Array.isArray(users) || users.length !== 8) {
  fail('باید دقیقاً ۸ کاربر تعریف شود: دو مدیر و شش راننده.');
}

const admins = users.filter((u) => ['owner_admin', 'operations_admin'].includes(u.role));
const drivers = users.filter((u) => u.role === 'driver');
if (admins.length !== 2 || drivers.length !== 6 || users.filter((u) => u.role === 'owner_admin').length !== 1 || users.filter((u) => u.role === 'operations_admin').length !== 1) {
  fail('تعداد حساب‌ها درست نیست؛ باید دقیقاً یک owner_admin، یک operations_admin و شش driver باشد.');
}
const driverNumbers = drivers.map((u) => u.driverNo).sort((a, b) => a - b);
if (driverNumbers.join(',') !== '1,2,3,4,5,6') {
  fail('شماره رانندگان باید دقیقاً از ۱ تا ۶ و بدون تکرار باشد.');
}
const emails = users.map((u) => String(u.email || '').trim().toLowerCase());
if (new Set(emails).size !== 8 || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes('your-company.com'))) {
  fail('برای هر ۸ حساب، ایمیل یکتا و واقعی شرکت وارد کنید؛ ایمیل‌های نمونه قابل استفاده نیستند.');
}
if (new Set(users.map((u) => u.password)).size !== 8) {
  fail('رمز عبور هر هشت حساب باید متفاوت باشد.');
}
for (const user of users) {
  if (!user.fullName || !user.password || String(user.password).startsWith('REPLACE_') || String(user.password).length < 12) {
    fail(`نام یا رمز عبور حساب ${user.email || '(بدون ایمیل)'} کامل نیست. رمز هر حساب باید حداقل ۱۲ نویسه و غیرتکراری باشد.`);
  }
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('اتصال به Supabase ...');
const { data: org, error: orgError } = await supabase
  .from('organizations')
  .upsert({ name: config.organizationName, slug: config.organizationSlug }, { onConflict: 'slug' })
  .select('id')
  .single();
if (orgError || !org) fail(`ساخت سازمان ناموفق بود: ${orgError?.message || 'پاسخی دریافت نشد'}`);

const { data: authList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) fail(`خواندن کاربران احراز هویت ناموفق بود: ${listError.message}`);
const existingUsers = new Map((authList.users || []).map((u) => [u.email?.toLowerCase(), u]));

for (const entry of users) {
  const email = entry.email.trim().toLowerCase();
  let authUser = existingUsers.get(email);
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: entry.password,
      email_confirm: true,
      user_metadata: { full_name: entry.fullName }
    });
    if (error || !data.user) fail(`ساخت حساب ${email} ناموفق بود: ${error?.message || 'کاربر ایجاد نشد'}`);
    authUser = data.user;
    console.log(`حساب ساخته شد: ${email}`);
  } else {
    console.log(`حساب از قبل موجود است؛ رمز آن تغییر نکرد: ${email}`);
  }

  const profile = {
    id: authUser.id,
    org_id: org.id,
    full_name: entry.fullName,
    email,
    role: entry.role,
    driver_no: entry.role === 'driver' ? entry.driverNo : null
  };
  const { error: profileError } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
  if (profileError) fail(`ثبت پروفایل ${email} ناموفق بود: ${profileError.message}`);
}

console.log('\nعملیات اولیه کامل شد.');
console.log('سازمان: ' + config.organizationName);
console.log('حساب‌های مدیریتی: ۲');
console.log('حساب‌های راننده: ۶');
console.log('توجه: فایل provision-users.json و .env.provision را محرمانه نگه دارید و هرگز در GitHub بارگذاری نکنید.');
