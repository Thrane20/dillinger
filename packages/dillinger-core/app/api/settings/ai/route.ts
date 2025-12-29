import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

const DATA_PATH = process.env.DILLINGER_ROOT || '/data';
const AI_SETTINGS_PATH = path.join(DATA_PATH, 'storage', 'settings', 'ai.json');

export interface AISettings {
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

async function ensureSettingsDir() {
  const dir = path.dirname(AI_SETTINGS_PATH);
  await fs.ensureDir(dir);
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

async function saveSettings(settings: AISettings): Promise<void> {
  await ensureSettingsDir();
  await fs.writeJson(AI_SETTINGS_PATH, settings, { spaces: 2 });
}

// GET - Load AI settings
export async function GET() {
  try {
    const settings = await loadSettings();
    
    // Mask API keys for security
    const maskedSettings: AISettings = {
      provider: settings.provider,
    };
    
    if (settings.openai?.apiKey) {
      maskedSettings.openai = {
        apiKey: '********' + settings.openai.apiKey.slice(-4),
        model: settings.openai.model || 'gpt-4o',
      };
    }
    
    if (settings.claude?.apiKey) {
      maskedSettings.claude = {
        apiKey: '********' + settings.claude.apiKey.slice(-4),
        model: settings.claude.model || 'claude-3-opus-20240229',
      };
    }
    
    return NextResponse.json({
      success: true,
      settings: maskedSettings,
      configured: !!(settings.openai?.apiKey || settings.claude?.apiKey),
    });
  } catch (error) {
    console.error('Failed to get AI settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load AI settings' },
      { status: 500 }
    );
  }
}

// POST - Save AI settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, openaiApiKey, openaiModel, claudeApiKey, claudeModel } = body;
    
    const currentSettings = await loadSettings();
    
    const newSettings: AISettings = {
      provider: provider || currentSettings.provider || 'openai',
    };
    
    // Update OpenAI settings if provided (don't update if masked value)
    if (openaiApiKey && !openaiApiKey.startsWith('********')) {
      newSettings.openai = {
        apiKey: openaiApiKey,
        model: openaiModel || 'gpt-4o',
      };
    } else if (currentSettings.openai) {
      newSettings.openai = {
        ...currentSettings.openai,
        model: openaiModel || currentSettings.openai.model,
      };
    }
    
    // Update Claude settings if provided (don't update if masked value)
    if (claudeApiKey && !claudeApiKey.startsWith('********')) {
      newSettings.claude = {
        apiKey: claudeApiKey,
        model: claudeModel || 'claude-3-opus-20240229',
      };
    } else if (currentSettings.claude) {
      newSettings.claude = {
        ...currentSettings.claude,
        model: claudeModel || currentSettings.claude.model,
      };
    }
    
    await saveSettings(newSettings);
    
    return NextResponse.json({
      success: true,
      message: 'AI settings saved successfully',
    });
  } catch (error) {
    console.error('Failed to save AI settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save AI settings' },
      { status: 500 }
    );
  }
}
