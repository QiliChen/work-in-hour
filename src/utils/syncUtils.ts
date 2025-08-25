// 数据同步工具函数

export interface SyncData {
  workDays: any[];
  settings: any;
  timestamp: number;
  version: string;
}

export interface SyncResponse {
  success: boolean;
  message?: string;
  error?: string;
  bindCode?: string;
  timestamp?: number;
  workDays?: any[];
  settings?: any;
}

// 生成随机绑定码
export function generateBindCode(): string {
  // 避免容易混淆的字符：O(字母O)、0(数字0)、1(数字1)、I(字母I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 上传数据到云端
export async function uploadData(bindCode: string): Promise<SyncResponse> {
  try {
    const workDays = JSON.parse(localStorage.getItem('workDays') || '[]');
    const settings = JSON.parse(localStorage.getItem('workSettings') || '{}');
    
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bindCode,
        workDays,
        settings
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      // 保存绑定码到本地
      localStorage.setItem('bindCode', bindCode);
      return result;
    } else {
      throw new Error(result.error || '上传失败');
    }
  } catch (error) {
    console.error('上传数据失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误'
    };
  }
}

// 从云端下载数据
export async function downloadData(bindCode: string): Promise<SyncResponse> {
  try {
    const response = await fetch(`/api/sync?bindCode=${encodeURIComponent(bindCode)}`);
    const result = await response.json();
    
    if (response.ok) {
      // 保存数据到本地
      if (result.workDays) {
        localStorage.setItem('workDays', JSON.stringify(result.workDays));
      }
      if (result.settings) {
        localStorage.setItem('workSettings', JSON.stringify(result.settings));
      }
      
      // 保存绑定码
      localStorage.setItem('bindCode', bindCode);
      
      return result;
    } else {
      throw new Error(result.error || '下载失败');
    }
  } catch (error) {
    console.error('下载数据失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误'
    };
  }
}

// 获取本地保存的绑定码
export function getLocalBindCode(): string | null {
  return localStorage.getItem('bindCode');
}

// 清除本地绑定码
export function clearLocalBindCode(): void {
  localStorage.removeItem('bindCode');
}
