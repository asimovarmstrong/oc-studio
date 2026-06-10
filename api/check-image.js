// Vercel Serverless Function - 查询通义万相生图结果
// GET /api/check-image?task_id=xxx

export default async function handler(req, res) {
  // 跨域支持
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { task_id } = req.query;

  if (!task_id) {
    return res.status(400).json({ error: '请提供 task_id' });
  }

  const WANX_KEY = process.env.WANX_API_KEY;
  if (!WANX_KEY) {
    return res.status(500).json({ error: '未配置通义万相 API Key' });
  }

  try {
    const response = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${task_id}`,
      {
        headers: {
          'Authorization': `Bearer ${WANX_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: '查询图片任务失败' });
    }

    const data = await response.json();
    const taskStatus = data.output?.task_status;

    if (taskStatus === 'SUCCEEDED') {
      const imageUrl = data.output?.results?.[0]?.url;
      return res.status(200).json({
        status: 'done',
        imageUrl,
        actualPrompt: data.output?.results?.[0]?.actual_prompt || '',
      });
    }

    if (taskStatus === 'FAILED') {
      return res.status(200).json({ status: 'failed' });
    }

    // PENDING 或 RUNNING
    return res.status(200).json({
      status: 'generating',
      taskStatus,
    });

  } catch (error) {
    console.error('Check image error:', error);
    return res.status(500).json({ error: '网络错误' });
  }
}
