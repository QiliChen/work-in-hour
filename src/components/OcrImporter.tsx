import React, { useRef, useState } from 'react';
// 按需导入默认导出
import Tesseract from 'tesseract.js';
// no-op

interface Props {
  onImport: (items: Array<{ date: string; hours: number }>, overwrite: boolean) => void;
}

// 简单OCR导入：支持形如 2025-08-01 或 2025/08/01，小时形如 11.3小时 / 11.3h
const OcrImporter: React.FC<Props> = ({ onImport }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [lang, setLang] = useState<'chi_sim+eng' | 'eng'>('chi_sim+eng');
  const [overwrite, setOverwrite] = useState<boolean>(false);
  const [showSample, setShowSample] = useState<boolean>(false);
  const sampleSrc = `${(import.meta as any).env?.BASE_URL ?? '/'}ocr-sample.jpg`;

  const parseText = (text: string) => {
    console.log('=== OCR 原始文本 ===');
    console.log(text);
    console.log('=== 开始解析 ===');
    
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const items: Array<{ date: string; hours: number }> = [];
    // 2025-08-01 / 2025/08/01 / 2025年08月01日
    // 支持OCR识别出的"星期 五"（中间有空格）
    const dateRegex = /(\d{4})[\-\/年](\d{2})[\-\/月](\d{2})\s*\(\s*星期\s*[一二三四五六日]\s*\)/;
    // 12.4小时 / 12.4 小时 / 12.4h / 12h（必须带单位，避免误匹配年份前两位"20"）
    // 支持OCR识别出的"小 时"（中间有空格），移除\b边界限制
    const hoursRegex = /(\d{1,2}(?:[\.,]\d)?)\s*(?:小\s*时|小時|h|H)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`\n--- 处理第 ${i + 1} 行: "${line}" ---`);
      
      const d = line.match(dateRegex);
      if (!d) {
        console.log('✗ 未找到日期');
        continue;
      }

      const y = d[1];
      const m = d[2];
      const dd = d[3];
      const date = `${y}-${m}-${dd}`;
      console.log(`✓ 找到日期: ${date}`);

      // 先在同一行找小时，否则在接下来的两行内寻找最近的小时数
      let h = line.match(hoursRegex);
      if (!h) {
        console.log('  同一行未找到小时，搜索后续行...');
        for (let j = 1; j <= 2 && i + j < lines.length; j++) {
          const searchLine = lines[i + j];
          console.log(`  搜索第 ${i + j + 1} 行: "${searchLine}"`);
          const h2 = searchLine.match(hoursRegex);
          if (h2) { 
            h = h2; 
            console.log(`✓ 找到小时: ${h2[0]} (数值: ${h2[1]})`);
            break; 
          } else {
            console.log('✗ 未找到小时');
          }
        }
      } else {
        console.log(`✓ 同一行找到小时: ${h[0]} (数值: ${h[1]})`);
      }
      
      // 调试：打印当前行的完整匹配测试
      console.log(`  调试 - 当前行完整文本: "${line}"`);
      console.log(`  调试 - 小时正则: ${hoursRegex}`);
      const allMatches = line.match(hoursRegex);
      console.log(`  调试 - 当前行所有小时匹配:`, allMatches);

      if (h && h[1]) {
        let hours = parseFloat(h[1].replace(',', '.'));
        console.log(`✓ 小时解析: ${h[1]} -> ${hours}`);
        
        // 合理区间约束，避免异常值
        if (hours > 14) {
          console.log(`⚠ 小时超出上限，限制为 14`);
          hours = 14;
        }
        if (hours < 0) {
          console.log(`⚠ 小时为负数，限制为 0`);
          hours = 0;
        }
        
        if (!Number.isNaN(hours)) {
          console.log(`✓ 最终小时: ${hours}`);
          items.push({ date, hours });
        } else {
          console.log(`✗ 小时解析失败`);
        }
      } else {
        console.log(`✗ 未找到小时信息`);
      }
    }
    
    console.log('\n=== 解析结果 ===');
    console.log(`成功解析: ${items.length} 条记录`);
    console.log('解析的项目:', items);
    console.log('=== 解析完成 ===\n');
    
    return items;
  };

  const handlePick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setBusy(true);
      setProgress('初始化OCR…');
      const { data } = await Tesseract.recognize(f as any, lang as any, {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && m.progress) {
            setProgress(`识别中 ${(m.progress * 100).toFixed(0)}%`);
          }
        },
      });
      const items = parseText(data.text);
      onImport(items, overwrite);
      setProgress(`完成，解析到 ${items.length} 条记录`);
    } catch (err) {
      setProgress('识别失败');
      console.error(err);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 标题和描述 */}
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem' }}>OCR 导入（本地识别）</div>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: '1.4' }}>
            上传手机工时截图，自动解析"日期 + 小时"。如果周六识别到8小时以上，会自动设置为小周。
          </div>
        </div>
        {/* 控件与示例并排布局 */}
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* 左列：控制选项 */}
          <div style={{ flex: '1 1 360px', minWidth: 300 }}>
            <div className="ocr-controls" style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                fontSize: 14, 
                color: '#475569', 
                cursor: 'pointer',
                minHeight: 44 // 移动端触摸友好
              }}>
                <input 
                  type="checkbox" 
                  checked={overwrite} 
                  onChange={(e) => setOverwrite(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                覆盖已有工时
              </label>
              
              <div className="ocr-language-group" style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: 14, color: '#475569' }}>识别语言：</span>
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value as any)} 
                  className="hour-input" 
                  style={{ 
                    width: 200,
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: 14,
                    minHeight: 44 // 移动端触摸友好
                  }}
                >
                  <option value="chi_sim+eng">中文（简体）+ 英文</option>
                  <option value="eng">英文</option>
                </select>
              </div>
              
              <button 
                className="btn-primary ocr-button" 
                onClick={handlePick} 
                disabled={busy}
                style={{ 
                  padding: '0.75rem 1.25rem',
                  fontSize: 14,
                  fontWeight: 600,
                  minWidth: 120,
                  minHeight: 44 // 移动端触摸友好
                }}
              >
                {busy ? '识别中...' : '选择图片'}
              </button>

              <button 
                className="btn-secondary"
                onClick={() => setShowSample(v => !v)}
                style={{
                  padding: '0.6rem 0.9rem',
                  fontSize: 14,
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#0f172a'
                }}
              >
                {showSample ? '收起示例' : '查看示例截图'}
              </button>
            </div>

            {/* 进度信息 */}
            {progress && (
              <div style={{ 
                marginTop: 8, 
                fontSize: 14, 
                color: '#475569',
                padding: '0.75rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {progress}
              </div>
            )}
          </div>

          {/* 右列：示例图片 */}
          {showSample && (
            <div style={{ flex: '0 1 320px', maxWidth: 360, minWidth: 260 }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12
              }}>
                <div style={{ fontSize: 14, color: '#334155', marginBottom: 8 }}>
                  示例：手机「个人月统计-休息天数」页面截图。建议裁掉无关内容以提升识别速度。
                </div>
                <div style={{ width: '100%', overflow: 'hidden', borderRadius: 8 }}>
                  <img 
                    src={sampleSrc} 
                    alt="OCR 示例截图（将图片放在 public/ocr-sample.jpg）"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                
              </div>
            </div>
          )}
        </div>
      </div>
      
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
};

export default OcrImporter;


