import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import OpenAI from 'openai';

const DATA_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const AI_SETTINGS_PATH = path.join(DATA_PATH, 'storage', 'settings', 'ai.json');

interface AISettings {
  openai?: {
    apiKey: string;
    model: string;
  };
  claude?: {
    apiKey: string;
    model: string;
  };
  provider: 'openai' | 'claude';
}

async function loadSettings(): Promise<AISettings> {
  try {
    if (await fs.pathExists(AI_SETTINGS_PATH)) {
      return await fs.readJson(AI_SETTINGS_PATH);
    }
  } catch (error) {
    console.error('Failed to load AI settings:', error);
  }
  return { provider: 'openai' };
}

const SYSTEM_PROMPT = `You are Dillinger AI, an expert assistant for troubleshooting Wine and Proton games on Linux. You specialize in:

1. Analyzing Docker container logs from Wine/Proton game containers
2. Identifying common issues like:
   - DLL problems (missing, wrong versions, native vs builtin)
   - GPU/DirectX/Vulkan errors
   - Video playback issues (DirectShow, quartz, wmvcore)
   - Audio problems
   - Missing dependencies
   - Permission issues
   - Wine prefix corruption

3. Providing actionable recommendations including:
   - WINEDLLOVERRIDES settings (format: "dll1=disabled;dll2=native,builtin")
   - Winetricks verbs to install (e.g., vcrun2019, dxvk, d3dx9, quartz)
   - Registry edits with exact paths and values
   - Environment variables to set
   - Alternative Wine versions or settings

Format your response clearly with:
- **Issue Summary**: Brief description of the problem
- **Root Cause**: What's causing the issue
- **Recommended Fixes**: Numbered list of fixes to try, starting with the most likely to work
- **Configuration Examples**: Exact values to use

Be concise but thorough. Focus on practical solutions.`;

const USER_PROMPT_TEMPLATE = `I am a gamer trying to run a Wine-based game on my Linux computer. Please analyze the following container logs and help me determine why the game isn't working properly.

Look for issues such as:
- DLL errors or missing libraries
- GPU/graphics errors
- Video playback problems
- Audio issues
- Crash indicators
- Wine prefix problems

Then provide recommendations for:
- WINEDLLOVERRIDES environment variable settings
- Winetricks verbs to install
- Registry edits (with exact paths and values)
- Any other configuration changes

Please do not:
- Suggest operating system installations for tools or upgrades - as this is fixed and cannot be changed.

Here are the logs:

\`\`\`
{LOGS}
\`\`\``;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logs } = body;

    if (!logs || typeof logs !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Logs are required' },
        { status: 400 }
      );
    }

    const settings = await loadSettings();

    if (!settings.openai?.apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'AI is not configured. Please add your OpenAI API key in Settings → AI.' 
        },
        { status: 400 }
      );
    }

    // Truncate logs if too long (keep last 15000 chars to stay within token limits)
    const truncatedLogs = logs.length > 15000 
      ? '...[truncated]...\n' + logs.slice(-15000) 
      : logs;

    const userPrompt = USER_PROMPT_TEMPLATE.replace('{LOGS}', truncatedLogs);

    const openai = new OpenAI({
      apiKey: settings.openai.apiKey,
    });

    const completion = await openai.chat.completions.create({
      model: settings.openai.model || 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'No response from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: response,
      model: settings.openai.model || 'gpt-4o',
      tokensUsed: completion.usage?.total_tokens,
    });

  } catch (error) {
    console.error('AI analysis failed:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key. Please check your OpenAI API key in Settings.' },
          { status: 401 }
        );
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'AI analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
