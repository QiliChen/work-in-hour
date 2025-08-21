import React, { useRef, useState } from 'react';
// 按需导入默认导出
import Tesseract from 'tesseract.js';
// no-op

interface Props {
  onImport: (items: Array<{ date: string; hours: number }>) => void;
}

// 简单OCR导入：支持形如 2025-08-01 或 2025/08/01，小时形如 11.3小时 / 11.3h
const OcrImporter: React.FC<Props> = ({ onImport }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [lang, setLang] = useState<'chi_sim+eng' | 'eng'>('chi_sim+eng');

  const parseText = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items: Array<{ date: string; hours: number }> = [];
    const dateRegex = /(\d{4})[-/年](\d{2})[-/月](\d{2})/;
    const hoursRegex = /(\d{1,2}(?:[\.,]\d)?)(?:\s*(?:小时|h|H))/i;
    for (const line of lines) {
      const d = line.match(dateRegex);
      const h = line.match(hoursRegex);
      if (d && h) {
        const y = d[1];
        const m = d[2];
        const dd = d[3];
        const date = `${y}-${m}-${dd}`;
        const hours = parseFloat(h[1].replace(',', '.'));
        if (!Number.isNaN(hours)) {
          items.push({ date, hours });
        }
      }
    }
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
      onImport(items);
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
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800 }}>OCR 导入（本地识别）</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>上传手机工时截图，自动解析“日期 + 小时”。</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={lang} onChange={(e) => setLang(e.target.value as any)} className="hour-input" style={{ width: 160, margin: 0 }}>
            <option value="chi_sim+eng">中文（简体）+ 英文</option>
            <option value="eng">英文</option>
          </select>
          <button className="btn-primary" onClick={handlePick} disabled={busy}>选择图片</button>
        </div>
      </div>
      {progress && <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>{progress}</div>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
};

export default OcrImporter;


