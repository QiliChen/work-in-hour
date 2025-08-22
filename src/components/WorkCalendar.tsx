import React, { useState, useMemo } from 'react';
import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { WorkDay, WorkSettings } from '../types';
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

  // 以下一帧再展示菜单，避免首次闪到点击位置再回到屏幕中间
  const openMenuCentered = () => {
    setShowActionMenu(false);
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(() => setShowActionMenu(true));
    } else {
      setTimeout(() => setShowActionMenu(true), 0);
    }
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
      // 添加小周配置
      const existingIndex = newWorkWeeks.findIndex(week => week.weekStart === weekStartStr);
      if (existingIndex >= 0) {
        newWorkWeeks[existingIndex] = { ...newWorkWeeks[existingIndex], isSmallWeek: true };
      } else {
        newWorkWeeks.push({
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          isSmallWeek: true
        });
      }
    } else {
      // 移除小周配置
      newWorkWeeks = newWorkWeeks.filter(week => week.weekStart !== weekStartStr);
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
      hours: 0 // 切换小周状态时重置工时
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

  const handleClearData = () => {
    if (window.confirm('确定要清除所有数据吗？此操作不可撤销！')) {
      localStorage.removeItem('workHourSettings');
      localStorage.removeItem('workHourData');
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
        </div>
        <h2 className="calendar-title">
          {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
        </h2>
        <div className="header-right">
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
              className={`calendar-day ${status} ${!isCurrentMonthDate ? 'other-month' : ''} ${!isWorkDayDate && !isSaturdayDate && !isSundayDate ? 'weekend' : ''} ${isTodayDate ? 'today' : ''}`}
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
            <button onClick={handleInputHours} className="action-menu-item">
              输入工时
            </button>
            <button onClick={handleToggleSmallWeek} className="action-menu-item">
              切换小周状态
            </button>
            <button onClick={handleToggleLeave} className="action-menu-item">
              切换请假状态
            </button>
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

