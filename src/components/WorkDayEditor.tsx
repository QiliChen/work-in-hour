import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import type { WorkDay } from '../types';

interface WorkDayEditorProps {
  workDay: WorkDay | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: string, updates: Partial<WorkDay>) => void;
}

const WorkDayEditor: React.FC<WorkDayEditorProps> = ({
  workDay,
  isOpen,
  onClose,
  onSave
}) => {
  const [hours, setHours] = useState('');
  const [isLeave, setIsLeave] = useState(false);

  useEffect(() => {
    if (workDay) {
      setHours(workDay.hours.toString());
      setIsLeave(workDay.isLeave);
    }
  }, [workDay]);

  const handleSave = () => {
    if (!workDay) return;

    const hoursNum = parseFloat(hours) || 0;
    onSave(workDay.date, {
      hours: hoursNum,
      isLeave
    });
    onClose();
  };

  const handleCancel = () => {
    if (workDay) {
      setHours(workDay.hours.toString());
      setIsLeave(workDay.isLeave);
    }
    onClose();
  };

  if (!isOpen || !workDay) return null;

  const dateObj = parseISO(workDay.date);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          编辑工时 - {format(dateObj, 'yyyy年MM月dd日')}
        </h3>

        <div className="space-y-4">
          {/* Date Info */}
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-600">
              <div>日期：{format(dateObj, 'yyyy-MM-dd')}</div>
              <div>星期：{format(dateObj, 'EEEE', { locale: undefined })}</div>
              <div>小周：{workDay.isSmallWeek ? '是' : '否'}</div>
              <div>要求工时：{workDay.requiredHours}小时</div>
            </div>
          </div>

          {/* Hours Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              实际工时（小时）
            </label>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              min="0"
              max="24"
              step="0.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入实际工作小时数"
            />
          </div>

          {/* Leave Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isLeave"
              checked={isLeave}
              onChange={(e) => setIsLeave(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isLeave" className="ml-2 text-sm text-gray-700">
              请假（不计算在工时要求中）
            </label>
          </div>

          {/* Status Display */}
          {!isLeave && (
            <div className="bg-blue-50 p-3 rounded-md">
              <div className="text-sm text-blue-800">
                <div>进度：{((parseFloat(hours) || 0) / workDay.requiredHours * 100).toFixed(1)}%</div>
                {parseFloat(hours) >= workDay.requiredHours ? (
                  <div className="text-green-600 font-medium">✓ 达到要求</div>
                ) : (
                  <div className="text-orange-600">
                    还需：{(workDay.requiredHours - (parseFloat(hours) || 0)).toFixed(1)}小时
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkDayEditor;

