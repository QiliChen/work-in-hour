import { useState, useEffect, useMemo } from 'react';
import { parseISO } from 'date-fns';
import WorkCalendar from './components/WorkCalendar';
import OcrImporter from './components/OcrImporter';
import WorkStats from './components/WorkStats';
import type { WorkDay, WorkSettings } from './types';
import { WorkTimeCalculator, defaultSettings } from './utils/workTimeCalculator';
import { getHolidays } from './utils/holidays';
import './App.css';

function App() {
  const [settings, setSettings] = useState<WorkSettings>(() => {
    const savedSettings = localStorage.getItem('workSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [workDays, setWorkDays] = useState<WorkDay[]>(() => {
    const savedWorkDays = localStorage.getItem('workDays');
    return savedWorkDays ? JSON.parse(savedWorkDays) : [];
  });
  const [showOcr, setShowOcr] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };
  
  // 已由日历内部处理编辑弹窗

  const calculator = useMemo(() => new WorkTimeCalculator(settings), [settings]);

  // 根据节假日数据，重新计算当前月份的 requiredHours（包含调休workday）
  const recomputeCurrentMonthDays = () => {
    setWorkDays(prev => {
      return prev.map(day => {
        const d = parseISO(day.date);
        if (
          d.getFullYear() === currentMonth.getFullYear() &&
          d.getMonth() === currentMonth.getMonth()
        ) {
          const newRequired = calculator.getRequiredHours(d);
          const newIsSmallWeek = calculator.isSmallWeekDay(d);
          if (day.requiredHours !== newRequired || day.isSmallWeek !== newIsSmallWeek) {
            return { ...day, requiredHours: newRequired, isSmallWeek: newIsSmallWeek };
          }
        }
        return day;
      });
    });
  };

  // 初始化公假日数据
  useEffect(() => {
    const initHolidays = async () => {
      const currentYear = new Date().getFullYear();
      try {
        await getHolidays(currentYear);
        console.log('公假日数据初始化完成');
        // 节假日数据到位后，重算当前月必需工时（包含调休workday）
        recomputeCurrentMonthDays();
      } catch (error) {
        console.error('公假日数据初始化失败:', error);
      }
    };
    
    initHolidays();
  }, []);

  // 随月份变化预取该年的节假日，确保同步查询可用
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const run = async () => {
      try {
        await getHolidays(year);
        recomputeCurrentMonthDays();
      } catch (e) {
        console.warn('预取公假日失败:', e);
      }
    };
    run();
  }, [currentMonth]);

  // 保存设置到本地存储
  useEffect(() => {
    localStorage.setItem('workSettings', JSON.stringify(settings));
    // 设置改变后，基于新规则重算当前月 requiredHours 与小周标记
    recomputeCurrentMonthDays();
  }, [settings]);

  // 保存工作数据到本地存储
  useEffect(() => {
    localStorage.setItem('workDays', JSON.stringify(workDays));
  }, [workDays]);

  // 初始化/刷新当前月数据（幂等且不重复）
  useEffect(() => {
    const currentMonthData = calculator.generateMonthData(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1
    );

    setWorkDays(prev => {
      const result: WorkDay[] = [];
      const prevMap = new Map(prev.map(d => [d.date, d] as const));

      // 保留非当月原数据原样
      for (const d of prev) {
        const dd = new Date(d.date);
        if (dd.getFullYear() !== currentMonth.getFullYear() || dd.getMonth() !== currentMonth.getMonth()) {
          result.push(d);
        }
      }

      // 当月：以最新计算结果为基准，保留已有的 hours/isLeave（避免OCR/手动录入被覆盖）
      for (const gen of currentMonthData.workDays) {
        const old = prevMap.get(gen.date);
        if (old) {
          result.push({
            ...gen,
            hours: old.hours ?? 0,
            isLeave: old.isLeave ?? false
          });
        } else {
          result.push(gen);
        }
      }

      return result;
    });
  }, [currentMonth, calculator]);

  // 计算统计数据 - 只统计当前月份
  const stats = useMemo(() => {
    console.log('=== 调试统计信息 ===');
    console.log('所有workDays数据:', workDays.length, '条');
    console.log('workDays数据:', workDays);
    
    // 只获取当前月份的数据
    const currentMonthDays = workDays.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate.getFullYear() === currentMonth.getFullYear() && 
             dayDate.getMonth() === currentMonth.getMonth();
    });

    console.log('当前月份数据:', currentMonthDays.length, '天');
    console.log('当前月份:', currentMonth.getFullYear(), currentMonth.getMonth() + 1);

    // 不在这里过滤，直接传入当前月份的所有数据给calculateStats
    console.log('传入统计的数据:', currentMonthDays.length, '天');
    console.log('传入统计的数据详情:', currentMonthDays);

    const filteredWorkDays = currentMonthDays;

    return calculator.calculateStats(filteredWorkDays);
  }, [workDays, calculator, currentMonth]);

  // 更新工作日数据
  const handleUpdateWorkDay = (date: string, updates: Partial<WorkDay>) => {
    setWorkDays(prevDays => {
      const updatedDays = calculator.updateWorkDay(prevDays, date, updates);
      return updatedDays;
    });
  };

  // 处理日历点击（已改为由子组件触发弹窗，不需要此函数）

  // 兼容保留：由子组件直接调用 onUpdateWorkDay



  return (
    <div className="app-container">
      <div className="container">
        {/* Header */}
        <div className="app-header">
          <h1 className="app-title">工时管理助手</h1>
          <p className="app-subtitle">
            跟踪你的工作时间，管理大小周，计算工时进度
          </p>
        </div>

        {/* Statistics */}
        <div className="card stats-card">
          <WorkStats
            stats={stats}
            settings={settings}
          />
        </div>

        {/* Calendar */}
        <div className="card calendar-card">
          <WorkCalendar
            settings={settings}
            workDays={workDays}
            onUpdateWorkDay={handleUpdateWorkDay}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onUpdateSettings={setSettings}
          />
        </div>

        {/* 下方独立 OCR 卡片已废弃，不再渲染 */}
        {/* modal trigger for calendar header */}
        <button id="ocr-modal-trigger" style={{ display: 'none' }} onClick={() => setShowOcr(true)} />
        {showOcr && (
          <div className="modal-overlay" onClick={() => setShowOcr(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <OcrImporter onImport={(items, overwrite) => {
                // 同步导入逻辑
                const currentYear = currentMonth.getFullYear();
                const currentMon = currentMonth.getMonth();
                let imported = 0;
                const smallWeekDates: string[] = [];
                const recognizedSet = new Set<string>();
                items.forEach(({ date, hours }) => {
                  const d = new Date(date);
                  if (d.getFullYear() === currentYear && d.getMonth() === currentMon) {
                    const existing = workDays.find(w => w.date === date);
                    if (overwrite || !existing || (existing && !existing.hours)) {
                      handleUpdateWorkDay(date, { hours });
                      imported += 1;
                      recognizedSet.add(date);
                    }
                    const dayOfWeek = d.getDay();
                    if (dayOfWeek === 6 && hours > 0) {
                      smallWeekDates.push(date);
                    }
                  }
                });

                // 预测小周：以当月第一周六为基准，存在两条 14 天节律序列：base0=第一周六，base1=第一周六+7。
                // 选择与已识别小周重合度更高的序列；如果只给了16号，应推算 2/16/30，而不是 9/23。
                if (smallWeekDates.length > 0) {
                  const recogDays = Array.from(new Set(smallWeekDates.map(dt => new Date(dt).getDate())));
                  const lastDay = new Date(currentYear, currentMon + 1, 0).getDate();
                  const ranges: Array<{ start: Date; end: Date; startStr: string; endStr: string }> = [];
                  
                  // 统一使用单锚定策略：以第一个识别到的小周日期为锚点，按14天间隔向前后递推
                  const anchor = recogDays[0];
                  const candidates: number[] = [];
                  
                  // 向后递推
                  for (let d = anchor; d <= lastDay; d += 14) {
                    candidates.push(d);
                  }
                  
                  // 向前递推
                  for (let d = anchor - 14; d >= 1; d -= 14) {
                    candidates.push(d);
                  }
                  
                  candidates.sort((a, b) => a - b);
                  
                  // 为每个候选日期创建周配置（只保留确实是周六的日期）
                  for (const d of candidates) {
                    const dt = new Date(currentYear, currentMon, d);
                    if (dt.getDay() !== 6) {
                      continue; // 确保是周六
                    }
                    
                    // 正确计算该周六所在周的周期（周一到周日）
                    const weekStart = new Date(dt);
                    const daysFromMonday = (dt.getDay() + 6) % 7; // 计算从周一开始的天数（周六是5天）
                    weekStart.setDate(dt.getDate() - daysFromMonday);
                    
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    
                    ranges.push({ 
                      start: weekStart, 
                      end: weekEnd, 
                      startStr: weekStart.toISOString().split('T')[0], 
                      endStr: weekEnd.toISOString().split('T')[0] 
                    });
                  }

                  // 同步更新配置和工作日数据
                  setSettings(prevSettings => {
                    // 清除当前月的所有小周配置
                    let newWorkWeeks = (prevSettings.workWeeks || []).filter(w => {
                      const ws = new Date(w.weekStart);
                      return !(ws.getFullYear() === currentYear && ws.getMonth() === currentMon);
                    });
                    
                    // 添加新的小周配置
                    for (const r of ranges) {
                      newWorkWeeks.push({ weekStart: r.startStr, weekEnd: r.endStr, isSmallWeek: true });
                    }
                    
                    const newSettings = { ...prevSettings, workWeeks: newWorkWeeks };
                    
                    // 立即更新 workDays 数据
                    setWorkDays(prevWorkDays => {
                      return prevWorkDays.map(day => {
                        const dayDate = new Date(day.date);
                        if (dayDate.getFullYear() === currentYear && dayDate.getMonth() === currentMon) {
                          const newRequiredHours = calculator.getRequiredHoursWithSettings(dayDate, newSettings);
                          const isSmallWeek = calculator.isSmallWeekDayWithSettings(dayDate, newSettings);
                          return { ...day, requiredHours: newRequiredHours, isSmallWeek };
                        }
                        return day;
                      });
                    });
                    
                    return newSettings;
                  });
                }
                setShowOcr(false);
                // 成功提示（面包条）
                showToast(`OCR 导入成功：${imported}/${items.length} 条`);
                // 自动请假：在识别日期范围内的工作日若无记录则标记为请假
                if (recognizedSet.size > 0) {
                  const sorted = Array.from(recognizedSet).sort();
                  const first = new Date(sorted[0]);
                  const last = new Date(sorted[sorted.length - 1]);
                  const calc = new WorkTimeCalculator(settings);
                  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
                    const ds = d.toISOString().split('T')[0];
                    if (recognizedSet.has(ds)) continue;
                    const req = calc.getRequiredHours(d);
                    if (req > 0) {
                      const exist = workDays.find(w => w.date === ds);
                      if (!exist || !exist.hours) {
                        handleUpdateWorkDay(ds, { isLeave: true, hours: 0 });
                      }
                    }
                  }
                }
              }} />
            </div>
          </div>
        )}

        {toast && (
          <div className="toast-banner">{toast}</div>
        )}


      </div>

      {/* 编辑功能由日历组件内置 */}
    </div>
  );
}

export default App;
