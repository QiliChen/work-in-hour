export interface WorkDay {
  date: string; // YYYY-MM-DD format
  hours: number; // 实际工时
  isSmallWeek: boolean; // 是否是小周
  isLeave: boolean; // 是否请假
  requiredHours: number; // 要求工时：11小时或8小时
  notes?: string; // 备注
}

export interface WorkWeek {
  weekStart: string; // 周开始日期 YYYY-MM-DD
  weekEnd: string; // 周结束日期 YYYY-MM-DD
  isSmallWeek: boolean; // 是否是小周
}

export interface WorkSettings {
  normalHours: number; // 正常工作日工时（11小时）
  smallWeekHours: number; // 小周工时（8小时）
  workWeeks: WorkWeek[]; // 按周设置的小周配置
  startDate: string; // 开始跟踪的日期
}

export interface WorkStats {
  totalDays: number; // 总工作天数
  totalHours: number; // 总实际工时
  totalRequired: number; // 总要求工时
  averageHours: number; // 平均工时
  remainingHours: number; // 还需完成的工时
  complianceRate: number; // 完成率百分比
  smallWeekDays: number; // 小周天数
  normalWeekDays: number; // 正常周天数
  leaveDays: number; // 请假天数
  workedDays: number; // 已工作天数（有输入工时的天数）
  normalWeekLeaveDays: number; // 工作日请假天数
  smallWeekLeaveDays: number;  // 小周请假天数
  futureSmallWeekDays: number; // 未来的小周天数
  futureWorkDays: number;      // 从今天开始的剩余工作日数
}

export interface MonthData {
  year: number;
  month: number; // 1-12
  workDays: WorkDay[];
  stats: WorkStats;
}

