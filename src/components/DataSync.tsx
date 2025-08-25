import React, { useState, useEffect } from 'react';
import { 
  uploadData, 
  downloadData, 
  generateBindCode, 
  getLocalBindCode,
  clearLocalBindCode
} from '../utils/syncUtils';

interface DataSyncProps {
  onSyncComplete?: () => void;
}

const DataSync: React.FC<DataSyncProps> = ({ onSyncComplete }) => {
  const [bindCode, setBindCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [localBindCode, setLocalBindCode] = useState<string | null>(null);

  useEffect(() => {
    // 加载本地保存的绑定码
    const savedBindCode = getLocalBindCode();
    if (savedBindCode) {
      setLocalBindCode(savedBindCode);
      setBindCode(savedBindCode);
    }
  }, []);

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  const handleGenerateCode = () => {
    const newCode = generateBindCode();
    setBindCode(newCode);
    showMessage(`生成新绑定码: ${newCode}`, 'success');
  };

  const handleUpload = async () => {
    if (!bindCode.trim()) {
      showMessage('请输入绑定码', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await uploadData(bindCode);
      if (result.success) {
        showMessage('数据上传成功！', 'success');
        setLocalBindCode(bindCode);
        onSyncComplete?.();
      } else {
        showMessage(result.error || '上传失败', 'error');
      }
    } catch (error) {
      showMessage('网络错误，请稍后重试', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!bindCode.trim()) {
      showMessage('请输入绑定码', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await downloadData(bindCode);
      if (result.success) {
        showMessage('数据下载成功！页面将自动刷新', 'success');
        setLocalBindCode(bindCode);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showMessage(result.error || '下载失败', 'error');
      }
    } catch (error) {
      showMessage('网络错误，请稍后重试', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearBindCode = () => {
    clearLocalBindCode();
    setLocalBindCode(null);
    setBindCode('');
    showMessage('已清除本地绑定码', 'success');
  };

  return (
    <div className="data-sync-container">
      <h3 className="sync-title">数据同步</h3>
      
      {message && (
        <div className={`sync-message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="sync-form">
        <div className="bind-code-section">
          <label htmlFor="bindCode" className="bind-code-label">
            绑定码:
          </label>
          <div className="bind-code-input-group">
            <input
              id="bindCode"
              type="text"
              value={bindCode}
              onChange={(e) => setBindCode(e.target.value.toUpperCase())}
              placeholder="输入6位绑定码"
              maxLength={6}
              className="bind-code-input"
            />
            <button
              onClick={handleGenerateCode}
              className="generate-btn"
              disabled={isLoading}
            >
              生成
            </button>
          </div>
        </div>

        <div className="sync-actions">
          <button
            onClick={handleUpload}
            disabled={isLoading || !bindCode.trim()}
            className="sync-btn upload-btn"
          >
            {isLoading ? '上传中...' : '上传数据'}
          </button>
          
          <button
            onClick={handleDownload}
            disabled={isLoading || !bindCode.trim()}
            className="sync-btn download-btn"
          >
            {isLoading ? '下载中...' : '下载数据'}
          </button>
        </div>

        {localBindCode && (
          <div className="local-bind-code">
            <span>当前绑定码: {localBindCode}</span>
            <button
              onClick={handleClearBindCode}
              className="clear-btn"
              disabled={isLoading}
            >
              清除
            </button>
          </div>
        )}
      </div>

      <div className="sync-tips">
        <p>💡 使用说明:</p>
        <ul>
          <li>输入6位绑定码，或点击"生成"创建新码</li>
          <li>上传：将本地数据保存到云端</li>
          <li>下载：从云端恢复数据到本地</li>
          <li>绑定码会保存在本地，方便下次使用</li>
        </ul>
      </div>
    </div>
  );
};

export default DataSync;
