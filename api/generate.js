export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const { ocData } = req.body;
  if (!ocData) return res.status(400).json({ error: '请提供 OC 数据' });
  const systemPrompt = `你是一个专业的 AI 绘图提示词工程师，擅长将角色设定转化为 Stable Diffusion / NovelAI / Midjourney 等 AI 绘图工具可用的高质量提示词。请根据用户提供的 OC 设定，生成以下 JSON 格式内容：{"standard":"英文通用提示词...","fantasy":"奇幻史诗风格...","anime":"日系动漫风格...","summary":"中文设定总结100字以内"}。只输出 JSON，不要其他文字。`;
  try {
    const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.MIMO_API_KEY}` },
      body: JSON.stringify({ model: 'mimo-v2-flash', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `OC设定如下：\n${ocData}` }], temperature: 0.8, max_tokens: 1500 }),
    });
    if (!response.ok) return res.status(500).json({ error: 'AI 服务暂时不可用' });
    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return res.status(200).json({ success: true, result: JSON.parse(jsonMatch[0]) });
    return res.status(200).json({ success: true, result: { standard: content, fantasy: '', anime: '', summary: '' } });
  } catch (e) {
    return res.status(500).json({ error: '网络错误：' + e.message });
  }
}
