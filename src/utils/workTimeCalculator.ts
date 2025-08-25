import type { WorkDay, WorkSettings, WorkStats, MonthData, WorkWeek } from '../types';
import { format, parseISO, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { isHolidaySync, isWorkdayAdjustmentSync } from './holidays';

export class WorkTimeCalculator {
  private settings: WorkSettings;

  constructor(settings: WorkSettings) {
    this.settings = settings;
  }

  // 判断某一天是否在工作日（周一到周五）
  isWorkDay(date: Date): boolean {
    const dayOfWeek = getDay(date); // 0=Sunday, 1=Monday, ..., 6=Saturday
    return dayOfWeek >= 1 && dayOfWeek <= 5; // 周一到周五
  }

  // 判断某一天是否为周六
  isSaturday(date: Date): boolean {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 6; // 周六
  }

  // 判断某一天是否为周日
  isSunday(date: Date): boolean {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 0; // 周日
  }

  // 判断某一天是否在小周内（周六）
  isSmallWeekDay(date: Date): boolean {
    if (!this.isSaturday(date)) return false; // 只有周六才可能是小周
    
    // const dateStr = format(date, 'yyyy-MM-dd');
    
    // 查找该日期所在的周配置
    const weekConfig = this.settings.workWeeks.find(week => {
      const weekStart = parseISO(week.weekStart);
      const weekEnd = parseISO(week.weekEnd);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    });

    return weekConfig?.isSmallWeek || false;
  }

  // 判断某一天是否为公假日
  isPublicHoliday(date: Date): boolean {
    const dateStr = format(date, 'yyyy-MM-dd');
    return isHolidaySync(dateStr);
  }

  // 判断某一天是否为调休工作日
  isWorkdayAdjustment(date: Date): boolean {
    const dateStr = format(date, 'yyyy-MM-dd');
    return isWorkdayAdjustmentSync(dateStr);
  }

  // 计算某一天需要的工时
  getRequiredHours(date: Date): number {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // 如果是公假日，不要求工时
    if (isHolidaySync(dateStr)) {
      return 0;
    }
    
    // 如果是调休工作日，按正常工作日要求
    if (isWorkdayAdjustmentSync(dateStr)) {
      return this.settings.normalHours;
    }
    
    if (this.isWorkDay(date)) {
      return this.settings.normalHours; // 工作日11小时
    }
    
    if (this.isSmallWeekDay(date)) {
      return this.settings.smallWeekHours; // 小周周六8小时
    }
    
    // 周日可以设置工时，但默认不要求
    if (this.isSunday(date)) {
      return 0; // 周日默认不要求工时
    }
    
    return 0; // 其他日期不要求工时
  }

  // 创建工作日数据
  createWorkDay(date: string, hours: number = 0, isLeave: boolean = false, notes?: string): WorkDay {
    const dateObj = parseISO(date);
    const isWorkDay = this.isWorkDay(dateObj);
    const isSmallWeek = this.isSmallWeekDay(dateObj);
    const isSunday = this.isSunday(dateObj);
    // 访问以决策 requiredHours
    // 注：不需要提前结果，这里直接用 getRequiredHours 计算
    const requiredHours = this.getRequiredHours(dateObj);

    return {
      date,
      hours: isWorkDay || isSmallWeek || isSunday || this.isWorkdayAdjustment(dateObj) ? hours : 0, // 工作日、小周周六、周日和调休工作日都可以记录工时
      isSmallWeek,
      isLeave: isWorkDay || isSmallWeek || isSunday || this.isWorkdayAdjustment(dateObj) ? isLeave : false, // 工作日、小周周六、周日和调休工作日都可以请假
      requiredHours,
      notes
    };
  }

  // 生成一个月的数据
  generateMonthData(year: number, month: number): MonthData {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const workDays: WorkDay[] = days
      .filter(day => this.isWorkDay(day) || this.isSaturday(day) || this.isSunday(day)) // 包含工作日、周六和周日
      .map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return this.createWorkDay(dateStr);
      });

    const stats = this.calculateStats(workDays);

    return {
      year,
      month,
      workDays,
      stats
    };
  }

  // 计算统计数据
  calculateStats(workDays: WorkDay[]): WorkStats {
    const totalDays = workDays.length;
    const totalHours = workDays.reduce((sum, day) => sum + day.hours, 0);
    
    // 计算要求工时（包括请假的天数）
    const totalRequired = workDays.reduce((sum, day) => {
      return sum + day.requiredHours; // 请假也要算工时要求
    }, 0);

    // 计算已工作天数（有输入工时的天数）
    const workedDays = workDays.filter(day => day.hours > 0).length;
    
    // 基于已工作天数计算平均工时
    const averageHours = workedDays > 0 ? totalHours / workedDays : 0;
    
    const remainingHours = totalRequired - totalHours;
    const complianceRate = totalRequired > 0 ? (totalHours / totalRequired) * 100 : 0;

    // 当天日期（用于排除“今天”）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = format(today, 'yyyy-MM-dd');

    // 统计各种类型的天数
    const smallWeekDays = workDays.filter(day => day.isSmallWeek).length;
    // 工作日天数：本月中（由上游已筛），排除今天，排除小周，包含调休工作日
    // 判定依据：requiredHours > 0 且 !isSmallWeek 且 非今天
    const normalWeekDays = workDays.filter(day => {
      return day.requiredHours > 0 && !day.isSmallWeek && day.date !== todayStr;
    }).length;
    
    // 区分工作日请假和小周请假
    const normalWeekLeaveDays = workDays.filter(day => !day.isSmallWeek && day.isLeave).length;
    const smallWeekLeaveDays = workDays.filter(day => day.isSmallWeek && day.isLeave).length;
    const leaveDays = normalWeekLeaveDays + smallWeekLeaveDays;

    // 计算未来的小周天数（从今天往后，不含今天）
    const futureSmallWeekDays = workDays.filter(day => {
      if (day.date === todayStr) return false; // 严格排除今天
      const dayDate = new Date(day.date);
      return dayDate > today && day.isSmallWeek && !day.isLeave;
    }).length;

    // 计算从明天开始的剩余工作日数（不含今天）
    const futureWorkDays = workDays.filter(day => {
      if (day.date === todayStr) return false; // 严格排除今天
      const dayDate = new Date(day.date);
      return dayDate > today && day.requiredHours > 0 && !day.isLeave;
    }).length;

    // 未来（不含今天）可完成容量（按每天的 requiredHours 精确求和）
    const futureRequiredSum = workDays.reduce((sum, day) => {
      if (day.date === todayStr) return sum; // 严格排除今天
      const dayDate = new Date(day.date);
      if (dayDate > today && day.requiredHours > 0 && !day.isLeave) {
        return sum + day.requiredHours;
      }
      return sum;
    }, 0);

    // 获取今天的工时信息
    // todayStr 已在上方声明
    const todayWorkDay = workDays.find(day => day.date === todayStr);
    const todayRequiredHours = todayWorkDay?.requiredHours || 0;
    const todayActualHours = todayWorkDay?.hours || 0;
    const todayIsSmallWeek = todayWorkDay?.isSmallWeek || false;
    const todayIsLeave = todayWorkDay?.isLeave || false;

    // 今天的预测与使用值（在获取信息之后计算）
    const todayPred = (!todayIsLeave && todayRequiredHours > 0) ? todayRequiredHours : 0;
    const todayUsed = (!todayIsLeave && todayRequiredHours > 0)
      ? (todayActualHours > 0 ? todayActualHours : todayRequiredHours)
      : 0;



    return {
      totalDays,
      totalHours,
      totalRequired,
      averageHours,
      remainingHours,
      complianceRate,
      smallWeekDays,
      normalWeekDays,
      leaveDays,
      workedDays,
      normalWeekLeaveDays, // 工作日请假天数
      smallWeekLeaveDays,  // 小周请假天数
      futureSmallWeekDays, // 未来的小周天数
      futureWorkDays,      // 从今天开始的剩余工作日数
      todayRequiredHours,  // 今天的工时要求
      todayActualHours,    // 今天的实际工时
      todayIsSmallWeek,    // 今天是否为小周
      todayIsLeave,        // 今天是否请假
      futureRequiredSum,   // 未来（不含今天）精确容量和
      todayPred,           // 今天的预测容量（请假或无要求为0）
      todayUsed            // 今天实际用于容量的数值（已填用实际，否则用预测；请假为0）
    };
  }

  // 更新工作日数据
  updateWorkDay(workDays: WorkDay[], date: string, updates: Partial<WorkDay>): WorkDay[] {
    return workDays.map(day =>
      day.date === date ? { ...day, ...updates } : day
    );
  }

  // 使用新settings重新计算requiredHours
  getRequiredHoursWithSettings(date: Date, newSettings: WorkSettings): number {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // 如果是公假日，不要求工时
    if (isHolidaySync(dateStr)) {
      return 0;
    }
    
    // 如果是调休工作日，按正常工作日要求
    if (isWorkdayAdjustmentSync(dateStr)) {
      return newSettings.normalHours;
    }
    
    if (this.isWorkDay(date)) {
      return newSettings.normalHours; // 工作日11小时
    }
    
    // 检查是否为小周周六
    const isSmallWeekDay = this.isSmallWeekDayWithSettings(date, newSettings);
    if (isSmallWeekDay) {
      return newSettings.smallWeekHours; // 小周周六8小时
    }
    
    // 周日可以设置工时，但默认不要求
    if (this.isSunday(date)) {
      return 0; // 周日默认不要求工时
    }
    
    return 0; // 其他日期不要求工时
  }

  // 使用新settings检查是否为小周
  isSmallWeekDayWithSettings(date: Date, newSettings: WorkSettings): boolean {
    if (!this.isSaturday(date)) {
      return false;
    }
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return newSettings.workWeeks.some(week => {
      const weekStart = parseISO(week.weekStart);
      const weekEnd = parseISO(week.weekEnd);
      const currentDate = parseISO(dateStr);
      return currentDate >= weekStart && currentDate <= weekEnd && week.isSmallWeek;
    });
  }

  // 获取日期范围的数据
  getDateRangeData(startDate: string, endDate: string): WorkDay[] {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = eachDayOfInterval({ start, end });

    return days
      .filter(day => this.isWorkDay(day) || this.isSaturday(day))
      .map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return this.createWorkDay(dateStr);
      });
  }

  // 添加周配置
  addWeekConfig(weekStart: string, weekEnd: string, isSmallWeek: boolean): WorkSettings {
    const newWeek: WorkWeek = {
      weekStart,
      weekEnd,
      isSmallWeek
    };

    return {
      ...this.settings,
      workWeeks: [...this.settings.workWeeks, newWeek]
    };
  }

  // 删除周配置
  removeWeekConfig(weekStart: string): WorkSettings {
    return {
      ...this.settings,
      workWeeks: this.settings.workWeeks.filter(week => week.weekStart !== weekStart)
    };
  }

  // 获取某个月的所有周
  getWeeksInMonth(year: number, month: number): WorkWeek[] {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    
    const weeks: WorkWeek[] = [];
    let currentDate = startOfWeek(startDate, { weekStartsOn: 1 }); // 周一开始

    while (currentDate <= endDate) {
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      const weekStartStr = format(currentDate, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      // 检查是否已有配置
      const existingConfig = this.settings.workWeeks.find(week => 
        week.weekStart === weekStartStr
      );

      weeks.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        isSmallWeek: existingConfig?.isSmallWeek || false
      });

      currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    return weeks;
  }
}

export const defaultSettings: WorkSettings = {
  normalHours: 11,
  smallWeekHours: 8,
  paydayDay: 15,
  workWeeks: [], // 空的周配置，需要手动设置
  startDate: format(new Date(), 'yyyy-MM-dd')
};

