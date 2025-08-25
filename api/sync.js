// Vercel Function for data synchronization
// 支持绑定码的数据上传和下载

export default async function handler(req, res) {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { bindCode, workDays, settings } = req.body;
      
      if (!bindCode) {
        return res.status(400).json({ error: '绑定码不能为空' });
      }

      // 简单的内存存储（临时方案）
      // 注意：Vercel Functions是无状态的，这里只是演示
      // 实际生产环境需要使用数据库
      global.userData = global.userData || {};
      global.userData[bindCode] = {
        workDays: workDays || [],
        settings: settings || {},
        timestamp: Date.now(),
        version: '1.0.0'
      };
      
      console.log(`数据上传成功: ${bindCode}`);
      res.status(200).json({ 
        success: true, 
        message: '数据上传成功',
        bindCode,
        timestamp: global.userData[bindCode].timestamp
      });
    } catch (error) {
      console.error('上传错误:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const { bindCode } = req.query;
      
      if (!bindCode) {
        return res.status(400).json({ error: '绑定码不能为空' });
      }

      const data = global.userData?.[bindCode];
      if (data) {
        console.log(`数据下载成功: ${bindCode}`);
        res.status(200).json({
          success: true,
          ...data
        });
      } else {
        console.log(`未找到数据: ${bindCode}`);
        res.status(404).json({ 
          error: '未找到该绑定码的数据',
          bindCode 
        });
      }
    } catch (error) {
      console.error('下载错误:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: '不支持的请求方法' });
  }
}
