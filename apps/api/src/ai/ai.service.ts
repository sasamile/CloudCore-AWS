import { Injectable, BadRequestException, Logger } from '@nestjs/common';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async chat(messages: ChatMessage[], context?: string) {
    const system: ChatMessage = {
      role: 'system',
      content: [
        'Eres un asistente de DevOps para ZynCloud. Ayudas a desplegar proyectos en contenedores Ubuntu.',
        'Responde en español, de forma clara y práctica. Da comandos concretos cuando sea útil.',
        context ? `\nContexto del usuario:\n${context}` : '',
      ].join('\n'),
    };

    const chain = [
      () => this.callGroq([system, ...messages]),
      () => this.callGemini([system, ...messages]),
      () => this.callKimi([system, ...messages]),
      () => this.callAnthropic([system, ...messages]),
      () => this.callOpenAI([system, ...messages]),
    ];

    for (const fn of chain) {
      try {
        const result = await fn();
        if (result) return result;
      } catch (error) {
        this.logger.warn(`AI provider failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    throw new BadRequestException('Ningún proveedor de IA está configurado o disponible');
  }

  private async callOpenAICompatible(
    url: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
  ) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 1500 }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Respuesta vacía');
    return { content, provider: model };
  }

  private callGroq(messages: ChatMessage[]) {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    return this.callOpenAICompatible(
      'https://api.groq.com/openai/v1/chat/completions',
      key,
      'llama-3.3-70b-versatile',
      messages,
    ).then((r) => ({ ...r, provider: 'groq' }));
  }

  private callKimi(messages: ChatMessage[]) {
    const key = process.env.KIMI_API_KEY;
    if (!key) return null;
    return this.callOpenAICompatible(
      'https://api.moonshot.cn/v1/chat/completions',
      key,
      'moonshot-v1-8k',
      messages,
    ).then((r) => ({ ...r, provider: 'kimi' }));
  }

  private callOpenAI(messages: ChatMessage[]) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    return this.callOpenAICompatible(
      'https://api.openai.com/v1/chat/completions',
      key,
      'gpt-4o-mini',
      messages,
    ).then((r) => ({ ...r, provider: 'openai' }));
  }

  private async callGemini(messages: ChatMessage[]) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const system = messages.find((m) => m.role === 'system')?.content;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
        }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Respuesta vacía');
    return { content, provider: 'gemini' };
  }

  private async callAnthropic(messages: ChatMessage[]) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;

    const system = messages.find((m) => m.role === 'system')?.content || '';
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1500,
        system,
        messages: chatMessages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) throw new Error('Respuesta vacía');
    return { content, provider: 'anthropic' };
  }
}
