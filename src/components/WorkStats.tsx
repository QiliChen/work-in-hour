import React from 'react';
import type { WorkStats as WorkStatsType } from '../types';

interface WorkStatsProps {
  stats: WorkStatsType;
  onShowOcr?: () => void;
  onShowSync?: () => void;
}

const WorkStats: React.FC<WorkStatsProps> = ({ stats, onShowOcr, onShowSync }) => {
  const formatHours = (hours: number) => hours.toFixed(1);

  return (
    <div className="work-stats">
      <div className="stats-header">
        <h2 className="stats-title">工时统计</h2>
        <div className="stats-actions">
          {onShowOcr && (
            <button 
              className="btn-secondary"
              onClick={onShowOcr}
            >
              📷 OCR导入
            </button>
          )}
          {onShowSync && (
            <button 
              className="btn-secondary"
              onClick={onShowSync}
            >
              ☁️ 数据同步
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{stats.workedDays}</div>
          <div className="stat-label">已工作天数</div>
        </div>

        <div className="stat-item">
          <div className="stat-value">{formatHours(stats.totalHours)}</div>
          <div className="stat-label">实际工时</div>
        </div>

        <div className="stat-item">
          <div className="stat-value">{formatHours(stats.totalRequired)}</div>
          <div className="stat-label">要求工时</div>
        </div>

        <div className="stat-item">
          <div className="stat-value">{formatHours(stats.averageHours)}</div>
          <div className="stat-label">日平均工时</div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">完成进度</span>
            <span className="progress-percentage">{stats.complianceRate.toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(stats.complianceRate, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* 详细统计 */}
        <div className="stats-breakdown">
          <div className="breakdown-item">
            <div className="breakdown-icon">📅</div>
            <div className="breakdown-content">
              <div className="breakdown-label">工作日天数</div>
              <div className="breakdown-value">{stats.normalWeekDays} 天</div>
              <div className="breakdown-note">11小时/天</div>
            </div>
          </div>
          
          <div className="breakdown-item">
            <div className="breakdown-icon">⚡</div>
            <div className="breakdown-content">
              <div className="breakdown-label">小周天数</div>
              <div className="breakdown-value">{stats.smallWeekDays} 天</div>
              <div className="breakdown-note">8小时/天</div>
            </div>
          </div>
          
          <div className="breakdown-item">
            <div className="breakdown-icon">🏖️</div>
            <div className="breakdown-content">
              <div className="breakdown-label">工作日请假</div>
              <div className="breakdown-value">{stats.normalWeekLeaveDays} 天</div>
              <div className="breakdown-note">11小时/天</div>
            </div>
          </div>
          
          <div className="breakdown-item">
            <div className="breakdown-icon">🌴</div>
            <div className="breakdown-content">
              <div className="breakdown-label">小周请假</div>
              <div className="breakdown-value">{stats.smallWeekLeaveDays} 天</div>
              <div className="breakdown-note">8小时/天</div>
            </div>
          </div>
        </div>

        {/* 未来展望 */}
        <div className="future-outlook">
          <h3>未来展望</h3>
          

          
          {/* 基于剩余工作日的展望 */}
          <div className="outlook-card">
            <div className="outlook-header">
              <span className="outlook-title">剩余工作日展望：</span>
              <span className="outlook-note">工作日11h，小周8h</span>
            </div>
            <div className="outlook-content">
              <div className="outlook-row">
                <span>当前剩余工时：</span>
                <span className="outlook-value">{formatHours(stats.remainingHours)}h</span>
              </div>
              <div className="outlook-row">
                <span>剩余工作日：</span>
                <span className="outlook-value">{stats.futureWorkDays} 天</span>
              </div>
              <div className="outlook-row">
                <span>其中小周天数：</span>
                <span className="outlook-value">{stats.futureSmallWeekDays} 天</span>
              </div>
              <div className="outlook-row">
                <span>预计可完成：</span>
                <span className="outlook-value">
                  {((stats.futureWorkDays - stats.futureSmallWeekDays) * 11 + stats.futureSmallWeekDays * 8)}h
                </span>
              </div>
              <div className="outlook-row">
                <span>工时差值：</span>
                <span className={`outlook-value ${
                  ((stats.futureWorkDays - stats.futureSmallWeekDays) * 11 + stats.futureSmallWeekDays * 8) - stats.remainingHours >= 0 ? 'positive' : 'negative'
                }`}>
                  {(() => {
                    const todayFix = (!stats.todayIsLeave && stats.todayRequiredHours > 0 && stats.todayActualHours === 0) ? stats.todayPred : 0;
                    const totalDiff = stats.futureRequiredSum + todayFix - stats.remainingHours;
                    const main = `${formatHours(totalDiff)}h`;
                    const hint = (!stats.todayIsLeave && stats.todayRequiredHours > 0 && stats.todayActualHours === 0)
                      ? `(今天预估+${formatHours(stats.todayPred)}h)`
                      : (stats.todayActualHours > 0 && !stats.todayIsLeave ? `(今天+${formatHours(stats.todayActualHours)}h)` : '');
                    return (
                      <>
                        <span className="outlook-strong">{main}</span>
                        {hint && <span className="outlook-hint"> {hint}</span>}
                      </>
                    );
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkStats;



