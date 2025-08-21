import React, { useState } from 'react';
import { WorkSettings } from '../types';

interface SettingsProps {
  settings: WorkSettings;
  onUpdateSettings: (settings: WorkSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);

  const weekDays = [
    { value: 0, label: '周日' },
    { value: 1, label: '周一' },
    { value: 2, label: '周二' },
    { value: 3, label: '周三' },
    { value: 4, label: '周四' },
    { value: 5, label: '周五' },
    { value: 6, label: '周六' }
  ];

  const handleSave = () => {
    onUpdateSettings(tempSettings);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempSettings(settings);
    setIsOpen(false);
  };

  const toggleSmallWeekDay = (day: number) => {
    const newSmallWeekDays = tempSettings.smallWeekDays.includes(day)
      ? tempSettings.smallWeekDays.filter(d => d !== day)
      : [...tempSettings.smallWeekDays, day];

    setTempSettings({
      ...tempSettings,
      smallWeekDays: newSmallWeekDays
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="设置"
      >
        ⚙️
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              工时设置
            </h3>

            <div className="space-y-4">
              {/* Normal Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  大周工时（小时）
                </label>
                <input
                  type="number"
                  value={tempSettings.normalHours}
                  onChange={(e) => setTempSettings({
                    ...tempSettings,
                    normalHours: parseFloat(e.target.value) || 11
                  })}
                  min="1"
                  max="24"
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Small Week Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  小周工时（小时）
                </label>
                <input
                  type="number"
                  value={tempSettings.smallWeekHours}
                  onChange={(e) => setTempSettings({
                    ...tempSettings,
                    smallWeekHours: parseFloat(e.target.value) || 8
                  })}
                  min="1"
                  max="24"
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Small Week Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  小周设置
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => (
                    <label key={day.value} className="flex flex-col items-center">
                      <input
                        type="checkbox"
                        checked={tempSettings.smallWeekDays.includes(day.value)}
                        onChange={() => toggleSmallWeekDay(day.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-xs text-gray-600 mt-1">{day.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  选中的日期将按小周工时计算
                </p>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  开始统计日期
                </label>
                <input
                  type="date"
                  value={tempSettings.startDate}
                  onChange={(e) => setTempSettings({
                    ...tempSettings,
                    startDate: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
      )}
    </>
  );
};

export default Settings;

