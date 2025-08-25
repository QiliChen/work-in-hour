import React, { useState, useMemo } from 'react';
import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { WorkDay, WorkSettings } from '../types';
import { deleteSpace } from '../api/supabaseClient';
import { WorkTimeCalculator } from '../utils/workTimeCalculator';
import { getHolidayNameSync, isWorkdayAdjustmentSync } from '../utils/holidays';

interface WorkCalendarProps {
  settings: WorkSettings;
  workDays: WorkDay[];
  onUpdateWorkDay: (date: string, updates: Partial<WorkDay>) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onUpdateSettings: (settings: WorkSettings) => void;
}

const WorkCalendar: React.FC<WorkCalendarProps> = ({
  settings,
  workDays,
  onUpdateWorkDay,
  currentMonth,
  onMonthChange,
  onUpdateSettings
}) => {
  const calculator = useMemo(() => new WorkTimeCalculator(settings), [settings]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showHourInput, setShowHourInput] = useState(false);
  const [hourInput, setHourInput] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [normalHoursInput, setNormalHoursInput] = useState<string>('');
  const [smallWeekHoursInput, setSmallWeekHoursInput] = useState<string>('');
  const [paydayInput, setPaydayInput] = useState<string>('');
  const [syncSpaceInput, setSyncSpaceInput] = useState<string>('');
  // 菜单固定居中，无需坐标状态

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // 获取日历开始日期（包含上个月的日期以填充第一周）
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // 周一开始
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }); // 周一开始
  
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const workDayMap = useMemo(() => {
    const map = new Map<string, WorkDay>();
    workDays.forEach(day => map.set(day.date, day));
    return map;
  }, [workDays]);

  // 计算当月发薪日：默认 settings.paydayDay（默认15日），若非工作日则回退至最近的工作日（requiredHours>0）
  const paydayStr = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const payday = Math.min(28, Math.max(1, settings.paydayDay ?? 15));
    // 从设置的发薪日开始往前找最近的工作日
    let d = new Date(year, month, payday);
    for (let i = 0; i < 7; i += 1) {
      const req = calculator.getRequiredHours(d);
      if (req > 0) {
        return format(d, 'yyyy-MM-dd');
      }
      d.setDate(d.getDate() - 1);
    }
    // 兜底：如果一周内都没找到（极端情况），返回设置的发薪日
    return format(new Date(year, month, payday), 'yyyy-MM-dd');
  }, [currentMonth, calculator, settings.paydayDay]);

  const handlePrevMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    onMonthChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    onMonthChange(newDate);
  };

  // 判断是否为工作日（周一到周五）
  const isWorkDay = (date: Date) => {
    const dayOfWeek = getDay(date);
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  };

  // 判断是否为周六
  const isSaturday = (date: Date) => {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 6;
  };

  // 判断是否为周日
  const isSunday = (date: Date) => {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 0;
  };

  // 判断是否为当前月份
    const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth() &&
           date.getFullYear() === currentMonth.getFullYear();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // 直接展示居中菜单，避免多余的隐藏/显示引起的闪动
  const openMenuCentered = () => {
    setShowActionMenu(true);
  };

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const workDay = workDayMap.get(dateStr);

    if (!workDay) return 'not-created';
    if (workDay.isLeave) return 'leave';

    // 基于 requiredHours 判断是否为需要上班的日子（包含调休workday）
    if (workDay.requiredHours <= 0) {
      // 无要求：若无工时则灰色；若录入了工时则显示为部分完成
      return workDay.hours > 0 ? 'partial' : 'weekend';
    }

    // 有要求：按完成度显示
    if (workDay.hours >= workDay.requiredHours) return 'completed';
    if (workDay.hours > 0) return 'partial';
    return 'empty';
  };

  const handleDayClick = (date: Date) => {
    // 只有当前月份的日期才能点击
    if (!isCurrentMonth(date)) return;
    
    if (!isWorkDay(date) && !isSaturday(date) && !isSunday(date)) return; // 工作日、周六和周日都可以点击
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const workDay = workDayMap.get(dateStr);
    
    if (!workDay) {
      // 创建新的工作日
      const newWorkDay = calculator.createWorkDay(dateStr);
      onUpdateWorkDay(dateStr, newWorkDay);
    }
    
    // 显示操作菜单 - 固定在屏幕中间（避免先渲染在点击处再跳到中间）
    setSelectedDate(dateStr);
    openMenuCentered();
  };

  const handleToggleSmallWeek = () => {
    if (!selectedDate) return;
    
    const workDay = workDayMap.get(selectedDate);
    if (!workDay) return;
    
    const newIsSmallWeek = !workDay.isSmallWeek;
    
    // 获取该日期所在的周
    const selectedDateObj = new Date(selectedDate);
    const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    
    // 更新settings中的workWeeks配置
    let newWorkWeeks = [...settings.workWeeks];
    
    if (newIsSmallWeek) {
      // 先移除与该周重叠的任何配置，避免重复/冲突
      newWorkWeeks = newWorkWeeks.filter(week => {
        const ws = new Date(week.weekStart);
        const we = new Date(week.weekEnd);
        return we < weekStart || ws > weekEnd;
      });
      // 添加小周配置
      newWorkWeeks.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        isSmallWeek: true
      });
    } else {
      // 关闭：移除任何覆盖所选日期所在周的配置（而非仅按 weekStart 匹配）
      newWorkWeeks = newWorkWeeks.filter(week => {
        const ws = new Date(week.weekStart);
        const we = new Date(week.weekEnd);
        return !(ws <= selectedDateObj && selectedDateObj <= we);
      });
    }
    
    const newSettings = { ...settings, workWeeks: newWorkWeeks };
    onUpdateSettings(newSettings);
    
    // 重新计算该日期的工时要求
    const calculator = new WorkTimeCalculator(newSettings);
    const newRequiredHours = calculator.getRequiredHours(selectedDateObj);
    console.log(`切换小周状态: ${selectedDate}, 新状态: ${newIsSmallWeek}, 新工时要求: ${newRequiredHours}`);
    
    onUpdateWorkDay(selectedDate, {
      isSmallWeek: newIsSmallWeek,
      requiredHours: newRequiredHours,
      hours: 0,
      // 当从小周关闭为普通周六（通常无要求）时，同时清除请假标记
      isLeave: newIsSmallWeek ? workDay.isLeave : false
    });
    
    setShowActionMenu(false);
  };

  const handleToggleLeave = () => {
    if (!selectedDate) return;
    
    const workDay = workDayMap.get(selectedDate);
    if (!workDay) return;
    
    const newIsLeave = !workDay.isLeave;
    
    console.log(`切换请假状态: ${selectedDate}, 新状态: ${newIsLeave}`);
    
    onUpdateWorkDay(selectedDate, {
      isLeave: newIsLeave,
      hours: 0 // 请假时重置工时
    });
    
    setShowActionMenu(false);
  };

  const handleInputHours = () => {
    if (!selectedDate) return;
    
    const workDay = workDayMap.get(selectedDate);
    if (!workDay) return;
    
    setHourInput(workDay.hours?.toString() || '');
    setShowActionMenu(false);
    setShowHourInput(true);
  };

  const handleHourSubmit = () => {
    if (!selectedDate) return;
    
    const hours = parseFloat(hourInput) || 0;
    onUpdateWorkDay(selectedDate, { hours });
    setShowHourInput(false);
    setSelectedDate(null);
    setHourInput('');
  };

  const handleHourCancel = () => {
    setShowHourInput(false);
    setSelectedDate(null);
    setHourInput('');
  };

  const handleReturnToCurrentMonth = () => {
    const today = new Date();
    onMonthChange(today);
  };

  const handleClearData = async () => {
    if (!window.confirm('确定要清除所有数据并解绑当前空间吗？此操作不可撤销！')) return;
    try {
      // 若设置了同步空间码，则同时清空该空间在云端的数据
      if ((settings as any)?.syncSpace) {
        await deleteSpace((settings as any).syncSpace as string);
      }
    } finally {
      // 清除本地持久化
      localStorage.removeItem('workSettings');
      localStorage.removeItem('workDays');
      // 可选：清理节假日缓存（若存在）
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('holiday_cyi_cache') || k.startsWith('holiday_cache')) {
          localStorage.removeItem(k);
        }
      });
      window.location.reload();
    }
  };

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className="work-calendar">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="header-left">
          <button
            onClick={handlePrevMonth}
            className="nav-button"
          >
            ← 上月
          </button>
          <button 
            onClick={handleReturnToCurrentMonth}
            className="quick-action-btn"
          >
            返回本月
          </button>
          <button 
            onClick={() => {
              setNormalHoursInput(String(settings.normalHours ?? 11));
              setSmallWeekHoursInput(String(settings.smallWeekHours ?? 8));
              setSyncSpaceInput(settings.syncSpace ?? '');
              setShowSettings(true);
            }}
            className="quick-action-btn"
            aria-label="设置工时"
          >
            ⚙️ 设置
          </button>
        </div>
        <h2 className="calendar-title">
          {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
        </h2>
        <div className="header-right">
          <button 
            onClick={() => {
              const el = document.getElementById('ocr-modal-trigger');
              if (el) el.click();
            }}
            className="quick-action-btn"
          >
            📷 OCR 导入
          </button>
          <button 
            onClick={handleClearData}
            className="quick-action-btn clear-btn"
          >
            清除数据
          </button>
          <button
            onClick={handleNextMonth}
            className="nav-button"
          >
            下月 →
          </button>
        </div>
      </div>



      {/* Week Days Header */}
      <div className="calendar-grid">
        {weekDays.map((day) => (
          <div key={day} className="weekday-header">
            周{day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {allDays.map((date, index) => {
          const status = getDayStatus(date);
          const dateStr = format(date, 'yyyy-MM-dd');
          const workDay = workDayMap.get(dateStr);
          const isWorkDayDate = isWorkDay(date);
          const isSaturdayDate = isSaturday(date);
          const isSundayDate = isSunday(date);
          const isCurrentMonthDate = isCurrentMonth(date);
          const isTodayDate = isToday(date);

          return (
            <div
              key={index}
              onClick={() => handleDayClick(date)}
              className={`calendar-day ${status} ${!isCurrentMonthDate ? 'other-month' : ''} ${!isWorkDayDate && !isSaturdayDate && !isSundayDate ? 'weekend' : ''} ${isTodayDate ? 'today' : ''} ${dateStr === paydayStr ? 'payday' : ''}`}
            >
              <div className="day-number">
                {format(date, 'd')}
              </div>

              {/* 公假日/调休徽标：调休优先显示“补” */}
              {(() => {
                if (isWorkdayAdjustmentSync(dateStr)) {
                  return (
                    <div className="holiday-name">补</div>
                  );
                }
                const holidayName = getHolidayNameSync(dateStr);
                if (holidayName) {
                  return (
                    <div className="holiday-name">{holidayName}</div>
                  );
                }
                return null;
              })()}



              {(isWorkDayDate || isSaturdayDate || isSundayDate) && workDay && (
                <div className="day-info">
                  <div>工时: {workDay.hours}h</div>
                  <div>要求: {workDay.requiredHours}h</div>
                  {workDay.isSmallWeek && (
                    <div className="small-week-badge">
                      小周
                    </div>
                  )}
                  {workDay.isLeave && (
                    <div className="leave-badge">
                      请假
                    </div>
                  )}
                                     {/* 本月今天之前未报备提醒 */}
                   {(() => {
                     const today = new Date();
                     today.setHours(0, 0, 0, 0);
                     const dayDate = new Date(dateStr);
                     return dayDate < today && 
                            dayDate.getMonth() === currentMonth.getMonth() &&
                            dayDate.getFullYear() === currentMonth.getFullYear() &&
                            workDay.requiredHours > 0 && 
                            !workDay.isLeave && 
                            !workDay.hours;
                   })() && (
                    <div style={{ 
                      backgroundColor: '#fef3c7', 
                      border: '1px solid #f59e0b',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      fontSize: '0.7rem',
                      color: '#92400e',
                      marginTop: '2px'
                    }}>
                      待报备
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hour Input Modal */}
      {showHourInput && (
        <div className="modal-overlay" onClick={handleHourCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>输入工时</h3>
            <p>日期: {selectedDate}</p>
            <input
              type="number"
              value={hourInput}
              onChange={(e) => setHourInput(e.target.value)}
              placeholder="请输入工时（小时）"
              className="hour-input"
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={handleHourSubmit} className="btn-primary">
                确定
              </button>
              <button onClick={handleHourCancel} className="btn-secondary">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>工时设置</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', marginBottom: '0.5rem' }}>工作日工时（h）</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={normalHoursInput}
                  onChange={(e) => setNormalHoursInput(e.target.value)}
                  className="hour-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', marginBottom: '0.5rem' }}>小周工时（h）</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={smallWeekHoursInput}
                  onChange={(e) => setSmallWeekHoursInput(e.target.value)}
                  className="hour-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', marginBottom: '0.5rem' }}>发薪日（1-28）</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  step={1}
                  value={paydayInput}
                  onChange={(e) => setPaydayInput(e.target.value)}
                  className="hour-input"
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#475569', marginBottom: '0.5rem' }}>同步空间码（可选）</label>
              <input
                type="text"
                value={syncSpaceInput}
                onChange={(e) => setSyncSpaceInput(e.target.value.trim())}
                className="hour-input"
                placeholder="填写相同空间码以在多端同步"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  const normal = Math.max(0, parseFloat(normalHoursInput) || 0);
                  const small = Math.max(0, parseFloat(smallWeekHoursInput) || 0);
                  const payday = Math.min(28, Math.max(1, parseInt(paydayInput || String(settings.paydayDay ?? 15), 10)));
                  onUpdateSettings({ ...settings, normalHours: normal, smallWeekHours: small, paydayDay: payday, syncSpace: syncSpaceInput || undefined });
                  setShowSettings(false);
                }}
              >
                保存
              </button>
              <button className="btn-secondary" onClick={() => setShowSettings(false)}>取消</button>
              {settings.syncSpace && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    // 清空当前空间码（仅本地），同时提示使用外部“清除数据”来解绑并清空云端数据
                    onUpdateSettings({ ...settings, syncSpace: undefined });
                    setSyncSpaceInput('');
                  }}
                >
                  清空空间码
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Menu */}
      {showActionMenu && (
        <div className="modal-overlay" onClick={() => setShowActionMenu(false)}>
          <div 
            className="action-menu"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              zIndex: 1001,
              transform: 'translate(-50%, -50%)' // 完全居中
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const workDay = selectedDate ? workDayMap.get(selectedDate) : undefined;
              const selectedDateObj = selectedDate ? new Date(selectedDate) : undefined;
              const isSaturdaySelected = selectedDateObj ? isSaturday(selectedDateObj) : false;
              const canToggleLeave = !!(workDay && workDay.requiredHours > 0);

              return (
                <>
                  <button onClick={handleInputHours} className="action-menu-item">
                    输入工时
                  </button>
                  {isSaturdaySelected && (
                    <button onClick={handleToggleSmallWeek} className="action-menu-item">
                      {workDay?.isSmallWeek ? '关闭小周' : '开启小周'}
                    </button>
                  )}
                  {canToggleLeave && (
                    <button onClick={handleToggleLeave} className="action-menu-item">
                      {workDay?.isLeave ? '关闭请假' : '开启请假'}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', borderColor: '#22c55e' }}></div>
          <span>完成</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderColor: '#f59e0b' }}></div>
          <span>部分完成</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', borderColor: '#ef4444' }}></div>
          <span>未完成</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', borderColor: '#94a3b8' }}></div>
          <span>请假</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', borderColor: '#3b82f6' }}></div>
                  <span>小周</span>
      </div>
    </div>

      {/* Instructions */}
      <div className="calendar-instructions">
        <button 
          onClick={() => setShowInstructions(!showInstructions)}
          className="instructions-toggle"
        >
          💡 使用说明 {showInstructions ? '▼' : '▶'}
        </button>
        {showInstructions && (
          <div className="instructions-content">
            <ul>
              <li>点击当前月份的工作日/周六/周日显示操作菜单</li>
              <li>可以输入工时、设置小周状态或请假</li>
              <li>绿色=完成，黄色=部分完成，红色=未完成</li>
              <li>灰色=休息日或未标记的周末</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkCalendar;

