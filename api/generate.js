// Vercel Serverless Function - API 中转 + 通义万相生图
// 保护你的 API Key 不暴露在前端

export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 跨域支持
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { ocData } = req.body;

  if (!ocData) {
    return res.status(400).json({ error: '请提供 OC 数据' });
  }

  // 构建发给 AI 的 prompt
  const systemPrompt = `你是一个专业的 AI 绘图提示词工程师，擅长将角色设定转化为 Stable Diffusion / NovelAI / Midjourney 等 AI 绘图工具可用的高质量提示词。
请根据用户提供的 OC（原创角色）设定信息，生成以下内容。

设定可能包含以下维度（并非全部都会填写）：外貌形象、性格标签、背景身份、能力风格、声音语言、象征主题、故事弧光、画风构图、场景氛围等。
请充分利用所有已填写的信息，未填写的部分可合理推测或忽略。

1. **英文提示词**（适用于 Stable Diffusion / NovelAI）：用逗号分隔的标签形式，涵盖外貌、服装、表情、姿势、画风、构图、场景、画质标签、光照氛围等。画风、构图、场景和情绪是最重要的 prompt 维度，务必融入。
2. **奇幻史诗风提示词**：在英文提示词基础上加入史诗奇幻元素，让画面更有故事感。
3. **小清新动漫风提示词**：日系动漫画风版本，色调柔和。
4. **中文设定总结**：用中文简洁总结这个角色的核心设定（150字以内），如果用户填写了核心主题和角色弧光，请融入总结。

输出格式请严格按照 JSON 返回（只返回 JSON，不要额外文字）：
{
  "standard": "英文提示词...",
  "fantasy": "奇幻史诗风提示词...",
  "anime": "小清新动漫风提示词...",
  "summary": "中文设定总结..."
}`;

  const userPrompt = `请根据以下 OC 设定生成提示词：\n\n${ocData}`;

  try {
    // ========== 第一步：MiMo 生成 prompt ==========
    const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MIMO_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mimo-v2-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiMo API Error:', errorText);
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // 解析 JSON 结果
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          standard: content,
          fantasy: '',
          anime: '',
          summary: '',
        };
      }
    } catch (parseError) {
      result = {
        standard: content,
        fantasy: '',
        anime: '',
        summary: '',
      };
    }

    // ========== 第二步：通义万相提交生图任务 ==========
    const WANX_KEY = process.env.WANX_API_KEY;
    let imageTaskId = null;

    if (WANX_KEY && result.standard) {
      try {
        // 构建生图 prompt（截取前800字符，API限制）
        const imgPrompt = result.standard.slice(0, 800);

        const imgResponse = await fetch(
          'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${WANX_KEY}`,
              'X-DashScope-Async': 'enable',
            },
            body: JSON.stringify({
              model: 'wanx2.0-t2i-turbo',
              input: {
                prompt: imgPrompt,
                negative_prompt: 'low quality, blurry, distorted, ugly, bad anatomy',
              },
              parameters: {
                size: '1024*1024',
                n: 1,
                prompt_extend: false,
                watermark: false,
              },
            }),
          }
        );

        if (imgResponse.ok) {
          const imgData = await imgResponse.json();
          imageTaskId = imgData.output?.task_id || null;
          console.log('通义万相任务已提交:', imageTaskId);
        } else {
          console.error('通义万相提交失败:', await imgResponse.text());
        }
      } catch (imgError) {
        console.error('通义万相请求异常:', imgError.message);
      }
    }

    return res.status(200).json({
      success: true,
      result,
      imageTaskId,
      imageStatus: imageTaskId ? 'generating' : 'unavailable',
    });

  } catch (error) {
    console.error('Fetch error:', error);
    return res.status(500).json({ error: '网络错误，请检查连接后重试' });
  }
}
