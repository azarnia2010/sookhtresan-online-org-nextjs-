"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

type Role = 'owner_admin' | 'operations_admin' | 'driver';
type Profile = {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: Role;
  driver_no: number | null;
  active: boolean;
};
type Report = {
  id: string;
  org_id: string;
  driver_id: string;
  report_date: string;
  vehicle_plate: string;
  customer_name: string;
  product_type: string;
  destination: string;
  liters: number | string;
  unit_price: number | string | null;
  total_amount: number | string | null;
  amount_mode: 'auto' | 'manual' | 'not_set';
  odometer_km: number | string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  manager_note: string | null;
  created_at: string;
};
type DriverSummary = {
  driver_id: string;
  full_name: string;
  driver_no: number;
  active: boolean;
  report_count: number | string;
  total_liters: number | string;
  total_amount: number | string;
  pending_count: number | string;
};
type ManagerSummary = {
  report_count: number;
  total_liters: number;
  total_amount: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  active_drivers: number;
};
type DashboardResponse = { summary: ManagerSummary; drivers: DriverSummary[] };
type AmountMode = 'auto' | 'manual' | 'not_set';

const PRODUCTS: Record<string, string> = {
  regular_gasoline: 'بنزین معمولی',
  premium_gasoline: 'بنزین سوپر',
  diesel: 'گازوئیل',
  kerosene: 'نفت سفید',
  other: 'سایر'
};
const STATUS_LABEL: Record<Report['status'], string> = {
  pending: 'در انتظار بررسی', approved: 'تأیید شده', rejected: 'نیازمند اصلاح'
};

function localDateValue() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function digits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٬/g, '')
    .replace(/٫/g, '.')
    .replace(/,/g, '');
}
function numberValue(value: string) {
  const normalized = digits(value).trim();
  if (!normalized) return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}
function nf(value: number | string | null | undefined, maximumFractionDigits = 1) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits }).format(Number.isFinite(n) ? n : 0);
}
function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 'ثبت نشده';
  return `${nf(value, 0)} ریال`;
}
function productLabel(value: string) {
  return PRODUCTS[value] || value;
}
function roleLabel(role: Role) {
  if (role === 'owner_admin') return 'مدیر کل';
  if (role === 'operations_admin') return 'مدیر عملیات';
  return 'راننده سوخت‌رسان';
}
function friendlyError(message: string) {
  if (/Invalid login credentials/i.test(message)) return 'ایمیل یا رمز عبور درست نیست.';
  if (/Email not confirmed/i.test(message)) return 'ایمیل این حساب هنوز تأیید نشده است.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'ارتباط با سرور برقرار نشد. اینترنت و تنظیمات Supabase را بررسی کنید.';
  return message;
}

export default function Portal() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [pageError, setPageError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState(localDateValue);
  const [reports, setReports] = useState<Report[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [managerSummary, setManagerSummary] = useState<ManagerSummary | null>(null);
  const [driverSummaries, setDriverSummaries] = useState<DriverSummary[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [liveState, setLiveState] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [formBusy, setFormBusy] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [customer, setCustomer] = useState('');
  const [product, setProduct] = useState('regular_gasoline');
  const [destination, setDestination] = useState('');
  const [liters, setLiters] = useState('');
  const [amountMode, setAmountMode] = useState<AmountMode>('auto');
  const [unitPrice, setUnitPrice] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!supabase) {
      setBooting(false);
      return;
    }
    let alive = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setLoginError(friendlyError(error.message));
      setAuthUser(data.session?.user ?? null);
      setBooting(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (!session) {
        setProfile(null);
        setReports([]);
        setPeople([]);
      }
    });
    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !authUser) {
      setProfile(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    void supabase.from('profiles')
      .select('id,org_id,full_name,email,role,driver_no,active')
      .eq('id', authUser.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setPageError(error?.message || 'برای این حساب، پروفایل سازمانی ثبت نشده است. با مدیر سامانه تماس بگیرید.');
          setProfile(null);
          setProfileLoading(false);
          return;
        }
        if (!data.active) {
          await supabase.auth.signOut();
          setPageError('این حساب توسط مدیر غیرفعال شده است.');
          setProfile(null);
          setProfileLoading(false);
          return;
        }
        setPageError('');
        setProfile(data as Profile);
        setProfileLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPageError(friendlyError(error instanceof Error ? error.message : 'خواندن پروفایل ناموفق بود.'));
        setProfile(null);
        setProfileLoading(false);
      });
    return () => { active = false; };
  }, [supabase, authUser]);

  const loadData = useCallback(async () => {
    if (!supabase || !profile) return;
    setDataLoading(true);
    setPageError('');
    try {
      if (profile.role === 'driver') {
        const { data, error } = await supabase.from('fueling_reports')
          .select('*')
          .eq('driver_id', profile.id)
          .eq('report_date', selectedDate)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        setReports((data || []) as Report[]);
        setManagerSummary(null);
        setDriverSummaries([]);
        setPeople([]);
      } else {
        const [dashboardResult, reportsResult, peopleResult] = await Promise.all([
          supabase.rpc('get_manager_dashboard', { p_from: selectedDate, p_to: selectedDate }),
          supabase.from('fueling_reports').select('*').eq('report_date', selectedDate).order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('id,org_id,full_name,email,role,driver_no,active').eq('org_id', profile.org_id).order('role').order('driver_no')
        ]);
        if (dashboardResult.error) throw dashboardResult.error;
        if (reportsResult.error) throw reportsResult.error;
        if (peopleResult.error) throw peopleResult.error;
        const dashboard = dashboardResult.data as DashboardResponse;
        setManagerSummary(dashboard?.summary || null);
        setDriverSummaries(dashboard?.drivers || []);
        setReports((reportsResult.data || []) as Report[]);
        setPeople((peopleResult.data || []) as Profile[]);
      }
    } catch (error) {
      setPageError(friendlyError(error instanceof Error ? error.message : 'دریافت اطلاعات ناموفق بود.'));
    } finally {
      setDataLoading(false);
    }
  }, [supabase, profile, selectedDate]);

  useEffect(() => {
    if (profile) void loadData();
  }, [profile, loadData]);

  useEffect(() => {
    if (!supabase || !profile) return;
    setLiveState('connecting');
    const filter = profile.role === 'driver'
      ? `driver_id=eq.${profile.id}`
      : `org_id=eq.${profile.org_id}`;
    const channel = supabase.channel(`sookhtresan-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fueling_reports', filter }, () => {
        void loadData();
      })
      .subscribe((status) => {
        setLiveState(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'offline' : 'connecting');
      });
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, profile, loadData]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setLoginBusy(true);
    setLoginError('');
    setPageError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword
    });
    if (error) setLoginError(friendlyError(error.message));
    setLoginBusy(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setAuthUser(null);
    setSuccess('از حساب کاربری خارج شدید.');
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile || profile.role !== 'driver') return;
    const litersValue = numberValue(liters);
    const priceValue = numberValue(unitPrice);
    const manualValue = numberValue(manualAmount);
    const odometerValue = odometer.trim() ? numberValue(odometer) : null;
    if (!plate.trim() || !customer.trim() || !destination.trim()) {
      setPageError('پلاک، نام مشتری و مقصد را کامل کنید.');
      return;
    }
    if (!Number.isFinite(litersValue) || litersValue <= 0) {
      setPageError('حجم تحویل باید عددی بزرگ‌تر از صفر باشد.');
      return;
    }
    if (amountMode === 'auto' && (!Number.isFinite(priceValue) || priceValue < 0)) {
      setPageError('برای محاسبه خودکار، قیمت هر لیتر را وارد کنید.');
      return;
    }
    if (amountMode === 'manual' && (!Number.isFinite(manualValue) || manualValue < 0)) {
      setPageError('مبلغ نهایی معتبر را وارد کنید.');
      return;
    }
    if (odometerValue !== null && (!Number.isFinite(odometerValue) || odometerValue < 0)) {
      setPageError('کیلومترشمار معتبر نیست.');
      return;
    }
    const total = amountMode === 'auto' ? Math.round(litersValue * priceValue) : amountMode === 'manual' ? manualValue : null;
    setFormBusy(true);
    setPageError('');
    setSuccess('');
    const reportValues = {
      p_vehicle_plate: plate.trim(),
      p_customer_name: customer.trim(),
      p_product_type: product,
      p_destination: destination.trim(),
      p_liters: litersValue,
      p_unit_price: amountMode === 'not_set' ? null : Number.isFinite(priceValue) ? priceValue : null,
      p_total_amount: total,
      p_amount_mode: amountMode,
      p_odometer_km: odometerValue,
      p_notes: notes.trim() || null
    };
    const result = editingReportId
      ? await supabase.rpc('driver_resubmit_report', { p_report_id: editingReportId, ...reportValues })
      : await supabase.from('fueling_reports').insert({
          org_id: profile.org_id,
          driver_id: profile.id,
          report_date: selectedDate,
          vehicle_plate: reportValues.p_vehicle_plate,
          customer_name: reportValues.p_customer_name,
          product_type: reportValues.p_product_type,
          destination: reportValues.p_destination,
          liters: reportValues.p_liters,
          unit_price: reportValues.p_unit_price,
          total_amount: reportValues.p_total_amount,
          amount_mode: reportValues.p_amount_mode,
          odometer_km: reportValues.p_odometer_km,
          notes: reportValues.p_notes,
          status: 'pending'
        });
    if (result.error) {
      setPageError(friendlyError(result.error.message));
    } else {
      setSuccess(editingReportId ? 'گزارش اصلاح شد و دوباره برای مدیر ارسال گردید.' : 'گزارش با موفقیت در دیتابیس مرکزی ثبت شد و برای مدیر ارسال گردید.');
      setEditingReportId(null);
      setPlate(''); setCustomer(''); setDestination(''); setLiters(''); setUnitPrice('');
      setManualAmount(''); setOdometer(''); setNotes(''); setAmountMode('auto');
      await loadData();
    }
    setFormBusy(false);
  }

  function beginEditReport(row: Report) {
    setEditingReportId(row.id);
    setPlate(row.vehicle_plate);
    setCustomer(row.customer_name);
    setProduct(row.product_type);
    setDestination(row.destination);
    setLiters(String(row.liters));
    setAmountMode(row.amount_mode);
    setUnitPrice(row.unit_price == null ? '' : String(row.unit_price));
    setManualAmount(row.amount_mode === 'manual' && row.total_amount != null ? String(row.total_amount) : '');
    setOdometer(row.odometer_km == null ? '' : String(row.odometer_km));
    setNotes(row.notes || '');
    setPageError('');
    setSuccess('گزارش ردشده برای اصلاح در فرم قرار گرفت.');
    document.getElementById('report-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEditReport() {
    setEditingReportId(null);
    setPlate(''); setCustomer(''); setDestination(''); setLiters(''); setUnitPrice('');
    setManualAmount(''); setOdometer(''); setNotes(''); setAmountMode('auto');
  }

  async function reviewReport(reportId: string, status: 'approved' | 'rejected') {
    if (!supabase) return;
    setPageError(''); setSuccess('');
    const note = status === 'approved' ? null : 'لطفاً اطلاعات گزارش را بررسی و اصلاح کنید.';
    const { error } = await supabase.rpc('manager_review_report', {
      p_report_id: reportId, p_status: status, p_note: note
    });
    if (error) setPageError(friendlyError(error.message));
    else {
      setSuccess(status === 'approved' ? 'گزارش تأیید شد.' : 'گزارش برای اصلاح علامت‌گذاری شد.');
      await loadData();
    }
  }

  async function setDriverActive(driverId: string, active: boolean) {
    if (!supabase) return;
    setPageError(''); setSuccess('');
    const { error } = await supabase.rpc('set_driver_active', { p_driver_id: driverId, p_active: active });
    if (error) setPageError(friendlyError(error.message));
    else {
      setSuccess(active ? 'حساب راننده فعال شد.' : 'حساب راننده غیرفعال شد.');
      await loadData();
    }
  }

  if (!supabase) {
    return <SetupRequired />;
  }
  if (booting || (authUser && profileLoading)) {
    return <div className="loading-screen"><div className="spinner" /><p>در حال اتصال امن به سامانه سوخت‌رسان...</p></div>;
  }
  if (!authUser || !profile) {
    return <LoginScreen
      email={loginEmail} password={loginPassword} busy={loginBusy}
      error={loginError || pageError} setEmail={setLoginEmail} setPassword={setLoginPassword}
      onSubmit={handleLogin} />;
  }

  const isAdmin = profile.role !== 'driver';
  const todayReports = reports;
  const countedReports = todayReports.filter((row) => row.status !== 'rejected');
  const todayLiters = countedReports.reduce((sum, row) => sum + Number(row.liters || 0), 0);
  const todayAmount = countedReports.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const driverNameById = new Map(people.map((person) => [person.id, person.full_name]));
  const managerCount = people.filter((person) => person.role !== 'driver').length;
  const driverCount = people.filter((person) => person.role === 'driver').length;

  return (
    <main className="portal-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">س</div>
          <div><strong>سامانه سوخت‌رسان</strong><span>مدیریت آنلاین عملیات ناوگان</span></div>
        </div>
        <div className="topbar-actions">
          <span className={`live-pill ${liveState}`}><i />{liveState === 'live' ? 'اتصال زنده' : liveState === 'offline' ? 'اتصال ناپایدار' : 'در حال اتصال'}</span>
          <button className="button button-quiet" onClick={handleLogout}>خروج</button>
        </div>
      </header>

      <section className="welcome-row">
        <div>
          <p className="eyebrow">{isAdmin ? 'پنل مدیریت سازمان' : `پنل راننده شماره ${nf(profile.driver_no || 0, 0)}`}</p>
          <h1>سلام، {profile.full_name}</h1>
          <p className="subheading">{roleLabel(profile.role)} · ثبت و پیگیری اطلاعات در دیتابیس مرکزی</p>
        </div>
        <label className="date-filter"><span>تاریخ گزارش</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
      </section>

      {(pageError || success) && <div className={`notice ${pageError ? 'notice-error' : 'notice-success'}`} role="status">{pageError || success}</div>}

      {isAdmin ? (
        <>
          <section className="metrics-grid">
            <Metric label="تعداد گزارش‌ها" value={nf(managerSummary?.report_count || 0, 0)} detail="در تاریخ انتخاب‌شده" icon="▤" />
            <Metric label="حجم کل تحویل" value={`${nf(managerSummary?.total_liters || 0)} لیتر`} detail="مجموع ثبت رانندگان" icon="◉" />
            <Metric label="مبلغ کل ثبت‌شده" value={money(managerSummary?.total_amount || 0)} detail="براساس گزارش‌های ثبت‌شده" icon="◇" />
            <Metric label="گزارش‌های در انتظار" value={nf(managerSummary?.pending_count || 0, 0)} detail={`${nf(managerSummary?.approved_count || 0, 0)} تأیید شده`} icon="◷" />
          </section>

          <section className="two-column-layout">
            <div className="panel panel-main">
              <div className="panel-heading">
                <div><p className="eyebrow">عملیات روزانه</p><h2>گزارش‌های رانندگان</h2></div>
                <button className="button button-quiet" onClick={() => void loadData()} disabled={dataLoading}>{dataLoading ? 'در حال دریافت...' : 'به‌روزرسانی'}</button>
              </div>
              {reports.length === 0 ? <EmptyState text="برای این تاریخ هنوز گزارشی ثبت نشده است." /> : (
                <div className="table-wrap"><table>
                  <thead><tr><th>راننده</th><th>خودرو / پلاک</th><th>مشتری و مقصد</th><th>نوع سوخت</th><th>لیتر</th><th>مبلغ</th><th>وضعیت</th><th>اقدام</th></tr></thead>
                  <tbody>{reports.map((row) => <tr key={row.id}>
                    <td>{driverNameById.get(row.driver_id) || 'راننده'}</td>
                    <td>{row.vehicle_plate}</td>
                    <td><b>{row.customer_name}</b><small>{row.destination}</small></td>
                    <td>{productLabel(row.product_type)}</td>
                    <td>{nf(row.liters)}</td>
                    <td>{money(row.total_amount)}</td>
                    <td><Status status={row.status} /></td>
                    <td>{row.status === 'pending' ? <div className="action-stack"><button className="button button-small button-success" onClick={() => void reviewReport(row.id, 'approved')}>تأیید</button><button className="button button-small button-danger" onClick={() => void reviewReport(row.id, 'rejected')}>اصلاح</button></div> : <span className="muted">ثبت نهایی</span>}</td>
                  </tr>)}</tbody>
                </table></div>
              )}
            </div>

            <aside className="panel">
              <div className="panel-heading"><div><p className="eyebrow">ساختار سازمانی</p><h2>کاربران سامانه</h2></div><span className="count-chip">{nf(people.length, 0)} حساب</span></div>
              <div className="account-summary">
                <div><strong>{nf(managerCount, 0)}</strong><span>مدیر</span></div>
                <div><strong>{nf(driverCount, 0)}</strong><span>راننده</span></div>
              </div>
              <div className="people-list">
                {people.map((person) => <div className="person-row" key={person.id}>
                  <div className={`avatar ${person.role === 'driver' ? 'avatar-driver' : 'avatar-admin'}`}>{person.role === 'driver' ? nf(person.driver_no || 0, 0) : 'م'}</div>
                  <div className="person-meta"><strong>{person.full_name}</strong><span>{roleLabel(person.role)}</span></div>
                  <span className={`account-state ${person.active ? 'is-active' : 'is-disabled'}`}>{person.active ? 'فعال' : 'غیرفعال'}</span>
                  {person.role === 'driver' && <button className="text-action" onClick={() => void setDriverActive(person.id, !person.active)}>{person.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>}
                </div>)}
              </div>
              <p className="small-note">حساب‌های اولیه شامل دو مدیر و شش راننده است. ساخت حساب جدید از طریق ابزار امن راه‌اندازی انجام می‌شود.</p>
            </aside>
          </section>

          <section className="panel driver-performance">
            <div className="panel-heading"><div><p className="eyebrow">مقایسه عملکرد</p><h2>خلاصه فعالیت شش راننده</h2></div></div>
            <div className="driver-cards">{driverSummaries.map((driver) => <div className="driver-card" key={driver.driver_id}>
              <div className="driver-card-head"><span className="driver-index">{nf(driver.driver_no, 0)}</span><div><strong>{driver.full_name}</strong><small>{driver.active ? 'حساب فعال' : 'حساب غیرفعال'}</small></div></div>
              <div className="driver-card-stats"><div><b>{nf(driver.report_count, 0)}</b><span>گزارش</span></div><div><b>{nf(driver.total_liters)}</b><span>لیتر</span></div><div><b>{nf(driver.pending_count, 0)}</b><span>در انتظار</span></div></div>
            </div>)}</div>
          </section>
        </>
      ) : (
        <>
          <section className="metrics-grid driver-metrics">
            <Metric label="تعداد تحویل‌ها" value={nf(countedReports.length, 0)} detail="گزارش‌های معتبر و در انتظار" icon="▤" />
            <Metric label="حجم تحویل" value={`${nf(todayLiters)} لیتر`} detail="مجموع ثبت‌های شما" icon="◉" />
            <Metric label="مبلغ ثبت‌شده" value={money(todayAmount)} detail="مجموع مبالغ مشخص‌شده" icon="◇" />
          </section>
          <section className="two-column-layout driver-layout">
            <div className="panel panel-main">
              <div className="panel-heading"><div><p className="eyebrow">ثبت عملیات</p><h2>{editingReportId ? 'اصلاح گزارش تحویل' : 'ثبت تحویل سوخت'}</h2></div><span className="secure-chip">ذخیره آنلاین</span></div>
              <form id="report-form" className="report-form" onSubmit={submitReport}>
                <div className="form-grid">
                  <label>پلاک خودرو<input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="مثلاً ۱۲الف۳۴۵ ایران ۶۷" maxLength={24} required /></label>
                  <label>نام مشتری / تحویل‌گیرنده<input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="نام مشتری یا مجموعه" required /></label>
                  <label>نوع سوخت<select value={product} onChange={(e) => setProduct(e.target.value)}>{Object.entries(PRODUCTS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
                  <label>مقصد / محل تحویل<input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="شهر، نشانی یا نام محل" required /></label>
                  <label>حجم تحویل (لیتر)<input inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="مثلاً ۳۵۰۰" required /></label>
                  <label>کیلومترشمار (اختیاری)<input inputMode="decimal" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="عدد کیلومتر" /></label>
                </div>
                <div className="amount-section">
                  <div className="amount-title"><strong>ثبت مبلغ</strong><span>مبلغ همراه گزارش در دیتابیس ذخیره می‌شود.</span></div>
                  <div className="mode-switch" role="group" aria-label="روش ثبت مبلغ">
                    <button type="button" className={amountMode === 'auto' ? 'selected' : ''} onClick={() => setAmountMode('auto')}>محاسبه خودکار</button>
                    <button type="button" className={amountMode === 'manual' ? 'selected' : ''} onClick={() => setAmountMode('manual')}>مبلغ دستی</button>
                    <button type="button" className={amountMode === 'not_set' ? 'selected' : ''} onClick={() => setAmountMode('not_set')}>بدون مبلغ</button>
                  </div>
                  {amountMode === 'auto' && <div className="calculation-row"><label>قیمت هر لیتر (ریال)<input inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="قیمت روز" /></label><div className="calculated-value"><span>مبلغ محاسبه‌شده</span><b>{Number.isFinite(numberValue(liters)) && Number.isFinite(numberValue(unitPrice)) ? money(numberValue(liters) * numberValue(unitPrice)) : '—'}</b></div></div>}
                  {amountMode === 'manual' && <label>مبلغ نهایی (ریال)<input inputMode="decimal" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="مبلغ نهایی دریافت‌شده" /></label>}
                  {amountMode === 'not_set' && <p className="small-note">این گزارش بدون مبلغ ثبت می‌شود و در جمع درآمد، صفر فرض نمی‌شود.</p>}
                </div>
                <label>توضیحات (اختیاری)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="توضیحات مربوط به تحویل، تأخیر یا مغایرت..." /></label>
                <button className="button button-primary button-submit" disabled={formBusy}>{formBusy ? 'در حال ارسال...' : editingReportId ? 'ارسال نسخه اصلاح‌شده برای مدیر' : 'ثبت و ارسال گزارش به مدیر'}</button>
                {editingReportId && <button type="button" className="button button-quiet cancel-edit" onClick={cancelEditReport}>انصراف از اصلاح</button>}
              </form>
            </div>
            <aside className="panel">
              <div className="panel-heading"><div><p className="eyebrow">سوابق</p><h2>گزارش‌های شما</h2></div><span className="count-chip">{nf(reports.length, 0)} مورد</span></div>
              {reports.length === 0 ? <EmptyState text="برای این تاریخ گزارشی ثبت نکرده‌اید." /> : <div className="report-list">{reports.map((row) => <article className="report-item" key={row.id}>
                <div className="report-item-head"><strong>{row.customer_name}</strong><Status status={row.status} /></div>
                <p>{row.vehicle_plate} · {productLabel(row.product_type)}</p>
                <div className="report-item-foot"><span>{nf(row.liters)} لیتر</span><b>{money(row.total_amount)}</b></div>
                {row.manager_note && <small className="manager-note">یادداشت مدیر: {row.manager_note}</small>}
                {row.status === 'rejected' && <button className="button button-small button-primary edit-report-button" onClick={() => beginEditReport(row)}>اصلاح و ارسال مجدد</button>}
              </article>)}</div>}
              <div className="driver-reminder"><strong>یادآوری</strong><p>پس از ثبت، گزارش مستقیماً به پنل مدیر ارسال می‌شود. برای اصلاح گزارش، با مدیر عملیات هماهنگ کنید.</p></div>
            </aside>
          </section>
        </>
      )}

      <footer className="portal-footer"><span>سامانه سازمانی سوخت‌رسان</span><span>اطلاعات روی دیتابیس آنلاین سازمان ذخیره می‌شود.</span></footer>
    </main>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></article>;
}
function Status({ status }: { status: Report['status'] }) {
  return <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>;
}
function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span>▤</span><p>{text}</p></div>;
}
function LoginScreen({
  email, password, busy, error, setEmail, setPassword, onSubmit
}: {
  email: string; password: string; busy: boolean; error: string;
  setEmail: (value: string) => void; setPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <main className="login-shell">
    <div className="login-brand"><div className="brand-mark">س</div><div><strong>سامانه سوخت‌رسان</strong><span>سامانه سازمانی مدیریت ناوگان</span></div></div>
    <section className="login-card">
      <div className="login-heading"><p className="eyebrow">ورود کاربران سازمان</p><h1>ورود به سامانه</h1><p>با حساب کاربری اختصاصی خود وارد شوید.</p></div>
      {error && <div className="notice notice-error">{error}</div>}
      <form onSubmit={onSubmit} className="login-form">
        <label>ایمیل سازمانی<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required /></label>
        <label>رمز عبور<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور حساب" required /></label>
        <button className="button button-primary button-submit" disabled={busy}>{busy ? 'در حال ورود...' : 'ورود امن'}</button>
      </form>
      <div className="login-help"><span>۲ حساب مدیر</span><i /> <span>۶ حساب راننده</span><i /> <span>ذخیره‌سازی مرکزی</span></div>
    </section>
    <p className="login-footnote">دسترسی فقط برای کاربران تعریف‌شده در سازمان امکان‌پذیر است.</p>
  </main>;
}
function SetupRequired() {
  return <main className="login-shell"><div className="login-brand"><div className="brand-mark">س</div><div><strong>سامانه سوخت‌رسان</strong><span>راه‌اندازی دیتابیس آنلاین</span></div></div>
    <section className="login-card setup-card"><p className="eyebrow">یک مرحله تا اتصال آنلاین</p><h1>تنظیمات دیتابیس هنوز انجام نشده است</h1><p>برای اتصال سایت به دیتابیس، متغیرهای زیر را در Vercel وارد کنید و سپس پروژه را دوباره Deploy کنید.</p>
      <div className="setup-code"><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></div>
      <p>راهنمای فارسی داخل فایل ZIP، مراحل ساخت دیتابیس، اجرای فایل SQL و ایجاد دو حساب مدیر و شش حساب راننده را توضیح می‌دهد.</p>
    </section>
  </main>;
}
