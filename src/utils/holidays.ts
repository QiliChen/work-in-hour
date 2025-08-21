// 中国公假日数据 - 使用 holiday.cyi.me 公共API
export interface Holiday {
  date: string;
  name: string;
  type: 'holiday' | 'workday'; // holiday=放假, workday=调休上班
}

// 缓存公假日数据
const holidayCache = new Map<number, Holiday[]>();
const pendingRequests = new Map<number, Promise<Holiday[]>>();
const STORAGE_KEY_PREFIX = 'holidays_cache_v1_';

// 仅从 holiday.cyi.me 获取数据
async function fetchHolidays(year: number): Promise<Holiday[]> {
  try {
    const useProxy = (import.meta as any).env?.VITE_USE_PROXY === '1';
    const base = useProxy ? '/cn-holiday' : 'https://holiday.cyi.me';
    const url = `${base}/api/holidays?year=${year}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`holiday.cyi.me http ${resp.status}`);
    const body = await resp.json();
    if (body && Array.isArray(body.days)) {
      const list: Holiday[] = body.days.map((d: any) => ({
        date: d.date,
        name: d.name || (d.isOffDay ? '节假日' : '调休上班'),
        type: d.isOffDay ? 'holiday' : 'workday',
      }));
      return list;
    }
    throw new Error('holiday.cyi.me response format unexpected');
  } catch (e) {
    console.error('获取holiday.cyi.me数据失败:', e);
    return [];
  }
}

// 备用公假日数据
function getFallbackHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];
  
  // 元旦
  holidays.push({ date: `${year}-01-01`, name: '元旦', type: 'holiday' });
  
  // 清明节
  holidays.push({ date: `${year}-04-04`, name: '清明节', type: 'holiday' });
  holidays.push({ date: `${year}-04-05`, name: '清明节', type: 'holiday' });
  holidays.push({ date: `${year}-04-06`, name: '清明节', type: 'holiday' });
  
  // 劳动节
  for (let i = 1; i <= 5; i++) {
    holidays.push({ date: `${year}-05-${i.toString().padStart(2, '0')}`, name: '劳动节', type: 'holiday' });
  }
  
  // 国庆节
  for (let i = 1; i <= 7; i++) {
    holidays.push({ date: `${year}-10-${i.toString().padStart(2, '0')}`, name: '国庆节', type: 'holiday' });
  }
  
  return holidays;
}

// 获取指定年份的公假日数据
export async function getHolidays(year: number): Promise<Holiday[]> {
  // 检查缓存
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  // 检查本地持久化缓存（localStorage）
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${year}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.data)) {
        const data = parsed.data as Holiday[];
        const cachedAt: number | undefined = parsed.cachedAt;
        const isFresh = typeof cachedAt === 'number' && (Date.now() - cachedAt) < 24 * 60 * 60 * 1000; // 24h TTL
        if (isFresh && data.length > 0) {
          holidayCache.set(year, data);
          return data;
        }
      }
    }
  } catch {
    // 忽略localStorage异常，继续走网络
  }
  
  // 避免并发重复请求
  if (pendingRequests.has(year)) {
    return pendingRequests.get(year)!;
  }

  const request = (async () => {
    // 从 holiday.cyi.me 获取数据
    const holidays = await fetchHolidays(year);
    
    // 缓存数据（内存 + localStorage）
    holidayCache.set(year, holidays);
    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${year}`,
        JSON.stringify({ data: holidays, cachedAt: Date.now() })
      );
    } catch {
      // localStorage 可能满或不可用，忽略
    }
    
    return holidays;
  })();

  pendingRequests.set(year, request);
  const res = await request;
  pendingRequests.delete(year);
  return res;
}

// 检查指定日期是否为公假日
export async function isHoliday(date: string): Promise<boolean> {
  const year = parseInt(date.substring(0, 4));
  const holidays = await getHolidays(year);
  return holidays.some(holiday => holiday.date === date && holiday.type === 'holiday');
}

// 检查指定日期是否为调休工作日
export async function isWorkdayAdjustment(date: string): Promise<boolean> {
  const year = parseInt(date.substring(0, 4));
  const holidays = await getHolidays(year);
  return holidays.some(holiday => holiday.date === date && holiday.type === 'workday');
}

// 获取指定日期的公假日名称
export async function getHolidayName(date: string): Promise<string | null> {
  const year = parseInt(date.substring(0, 4));
  const holidays = await getHolidays(year);
  const holiday = holidays.find(h => h.date === date);
  return holiday ? holiday.name : null;
}

// 同步版本的函数（用于兼容现有代码）
export function isHolidaySync(date: string): boolean {
  const year = parseInt(date.substring(0, 4));
  const holidays = holidayCache.get(year) || [];
  return holidays.some(holiday => holiday.date === date && holiday.type === 'holiday');
}

export function isWorkdayAdjustmentSync(date: string): boolean {
  const year = parseInt(date.substring(0, 4));
  const holidays = holidayCache.get(year) || [];
  return holidays.some(holiday => holiday.date === date && holiday.type === 'workday');
}

export function getHolidayNameSync(date: string): string | null {
  const year = parseInt(date.substring(0, 4));
  const holidays = holidayCache.get(year) || [];
  const holiday = holidays.find(h => h.date === date);
  return holiday ? holiday.name : null;
}
