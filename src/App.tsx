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
  }, [settings]);

  // 保存工作数据到本地存储
  useEffect(() => {
    localStorage.setItem('workDays', JSON.stringify(workDays));
  }, [workDays]);

  // 初始化数据
  useEffect(() => {
    const currentMonthData = calculator.generateMonthData(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1
    );
    
    // 合并现有数据和新生成的数据
    const existingDays = workDays.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate.getFullYear() === currentMonth.getFullYear() && 
             dayDate.getMonth() === currentMonth.getMonth();
    });
    
    const newDays = currentMonthData.workDays.filter(newDay => 
      !existingDays.some(existingDay => existingDay.date === newDay.date)
    );
    
    if (newDays.length > 0) {
      setWorkDays(prev => [...prev, ...newDays]);
    }
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

    // 进一步过滤，只包含有工时要求的天数（工作日+小周周六）
    const workDaysOnly = currentMonthDays.filter(day => {
      return day.requiredHours > 0; // 只统计有工时要求的天数
    });

    console.log('有工时要求的天数:', workDaysOnly.length, '天');
    console.log('有工时要求的数据:', workDaysOnly);

    const filteredWorkDays = workDaysOnly;

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

  // 清除所有数据（调试用）
  const handleClearData = () => {
    if (confirm('确定要清除所有数据吗？')) {
      localStorage.removeItem('workDays');
      localStorage.removeItem('workSettings');
      setWorkDays([]);
      setSettings(defaultSettings);
      console.log('数据已清除');
    }
  };

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

        {/* OCR Importer */}
        <OcrImporter
          onImport={(items, overwrite) => {
            // 仅导入当前月份的记录；默认不覆盖已有 hours
            const currentYear = currentMonth.getFullYear();
            const currentMon = currentMonth.getMonth();
            let imported = 0;
            items.forEach(({ date, hours }) => {
              const d = new Date(date);
              if (d.getFullYear() === currentYear && d.getMonth() === currentMon) {
                const existing = workDays.find(w => w.date === date);
                if (overwrite || !existing || (existing && !existing.hours)) {
                  handleUpdateWorkDay(date, { hours });
                  imported += 1;
                }
              }
            });
            console.log(`OCR导入完成：${imported}/${items.length} 条写入（仅当前月）`);
          }}
        />

        {/* Quick Actions */}
        <div className="card quick-actions">
          <h2>快速操作</h2>
          <div className="actions-grid">
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="action-button"
            >
              <div className="action-title">返回本月</div>
              <div className="action-description">跳转到当前月份</div>
            </button>

            <button
              onClick={handleClearData}
              className="action-button"
              style={{ backgroundColor: '#fee2e2', borderColor: '#ef4444' }}
            >
              <div className="action-title">清除数据</div>
              <div className="action-description">清除所有数据（调试用）</div>
            </button>
          </div>
        </div>
      </div>

      {/* 编辑功能由日历组件内置 */}
    </div>
  );
}

export default App;
