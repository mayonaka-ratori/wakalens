const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { 
    validateAndSanitizeInput, 
    claudeApiLimiter, 
    validateContentQuality 
} = require('../middleware/security');
const ClaudeResponseValidator = require('../utils/claudeResponseValidator');

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// Initialize response validator
const responseValidator = new ClaudeResponseValidator();

// Load persona prompt
let personaPrompt = null;
const loadPersonaPrompt = async () => {
  if (!personaPrompt) {
    try {
      const promptPath = path.join(__dirname, '../../prompts/prompt_aichan_8yo.txt');
      personaPrompt = await fs.readFile(promptPath, 'utf8');
    } catch (error) {
      console.error('Failed to load persona prompt:', error);
      throw new Error('ペルソナプロンプトの読み込みに失敗しました');
    }
  }
  return personaPrompt;
};

// Step 1: Extract facts from text
router.post('/extract-facts', claudeApiLimiter, validateAndSanitizeInput, validateContentQuality, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'テキストが短すぎるか、空です'
      });
    }

    const prompt = `Act as a neutral data extractor. Read the following Japanese text and extract its core factual statements into a simple, objective, bulleted list. Do not add any interpretation, explanation, or personality. Present the facts in Japanese.

TEXT: ${text}`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const extractedFacts = response.content[0].text;
    
    res.json({
      success: true,
      facts: extractedFacts,
      originalText: text
    });

  } catch (error) {
    console.error('Fact extraction error:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Claude APIキーが無効です'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'APIの利用制限に達しました。しばらく待ってから再試行してください'
      });
    }

    res.status(500).json({
      error: 'Fact extraction failed',
      message: '事実抽出に失敗しました'
    });
  }
});

// Step 2: Translate with Aichan persona
router.post('/translate-persona', claudeApiLimiter, validateAndSanitizeInput, validateContentQuality, async (req, res) => {
  try {
    const { facts } = req.body;
    
    if (!facts || facts.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid input',
        message: '事実リストが短すぎるか、空です'
      });
    }

    // Load persona prompt
    const prompt = await loadPersonaPrompt();
    const combinedPrompt = prompt + '\n\n--- START OF FACTS TO EXPLAIN ---\n' + facts + '\n--- END OF FACTS TO EXPLAIN ---';

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: combinedPrompt
        }
      ]
    });

    const translation = response.content[0].text;
    
    res.json({
      success: true,
      translation: translation,
      facts: facts
    });

  } catch (error) {
    console.error('Persona translation error:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Claude APIキーが無効です'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'APIの利用制限に達しました。しばらく待ってから再試行してください'
      });
    }

    res.status(500).json({
      error: 'Translation failed',
      message: 'ペルソナ翻訳に失敗しました'
    });
  }
});

// Combined endpoint: Full translation pipeline (1-3年生モード)
router.post('/translate', claudeApiLimiter, validateAndSanitizeInput, validateContentQuality, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'テキストが短すぎるか、空です'
      });
    }

    // Step 1: Extract facts
    const factPrompt = `Act as a neutral data extractor. Read the following Japanese text and extract its core factual statements into a simple, objective, bulleted list. Do not add any interpretation, explanation, or personality. Present the facts in Japanese.

TEXT: ${text}`;

    const factResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: factPrompt
        }
      ]
    });

    const facts = factResponse.content[0].text;

    // Step 2: Translate with persona
    const personaPromptContent = await loadPersonaPrompt();
    const combinedPrompt = personaPromptContent + '\n\n--- START OF FACTS TO EXPLAIN ---\n' + facts + '\n--- END OF FACTS TO EXPLAIN ---';

    const translationResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: combinedPrompt
        }
      ]
    });

    let translation = translationResponse.content[0].text;
    
    // レスポンス品質検証と改善
    const validation = responseValidator.validateResponse(translation, '1-3');
    if (validation.confidence < 80) {
      console.warn('⚠️ 低品質レスポンス検出:', validation.issues);
      translation = await responseValidator.improveResponse(translation, validation, '1-3');
    }
    
    res.json({
      success: true,
      originalText: text,
      extractedFacts: facts,
      translation: translation,
      processingSteps: 2,
      quality: {
        confidence: validation.confidence,
        issues: validation.issues
      }
    });

  } catch (error) {
    console.error('Full translation error:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Claude APIキーが無効です'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'APIの利用制限に達しました。しばらく待ってから再試行してください'
      });
    }

    res.status(500).json({
      error: 'Translation failed',
      message: '翻訳処理に失敗しました'
    });
  }
});

// Combined endpoint: Full translation pipeline (4-6年生モード)
router.post('/translate-4-6', claudeApiLimiter, validateAndSanitizeInput, validateContentQuality, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'テキストが短すぎるか、空です'
      });
    }

    // Step 1: Extract facts
    const factPrompt = `Act as a neutral data extractor. Read the following Japanese text and extract its core factual statements into a simple, objective, bulleted list. Do not add any interpretation, explanation, or personality. Present the facts in Japanese.

TEXT: ${text}`;

    const factResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: factPrompt
        }
      ]
    });

    const facts = factResponse.content[0].text;

    // Step 2: Translate with 4-6年生 persona
    let personaPromptContent;
    try {
      const personaPromptPath = path.join(__dirname, '../../prompts/prompt_aichan_4-6yo.txt');
      personaPromptContent = await fs.readFile(personaPromptPath, 'utf8');
    } catch (fileError) {
      return res.status(500).json({
        error: 'Persona prompt missing',
        message: 'ペルソナプロンプトファイルが見つかりません: prompt_aichan_4-6yo.txt'
      });
    }
    const combinedPrompt = personaPromptContent + '\n\n--- START OF FACTS TO EXPLAIN ---\n' + facts + '\n--- END OF FACTS TO EXPLAIN ---';

    const translationResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: combinedPrompt
        }
      ]
    });

    let translation = translationResponse.content[0].text;
    
    // レスポンス品質検証と改善（4-6年生モード）
    const validation = responseValidator.validateResponse(translation, '4-6');
    if (validation.confidence < 80) {
      console.warn('⚠️ 低品質レスポンス検出 (4-6):', validation.issues);
      translation = await responseValidator.improveResponse(translation, validation, '4-6');
    }
    
    res.json({
      success: true,
      originalText: text,
      extractedFacts: facts,
      translation: translation,
      processingSteps: 2,
      ageMode: '4-6',
      quality: {
        confidence: validation.confidence,
        issues: validation.issues
      }
    });

  } catch (error) {
    console.error('Full translation error (4-6):', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Claude APIキーが無効です'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'APIの利用制限に達しました。しばらく待ってから再試行してください'
      });
    }

    res.status(500).json({
      error: 'Translation failed',
      message: '翻訳処理に失敗しました'
    });
  }
});

// Combined endpoint: Full translation pipeline (English mode)
router.post('/translate-english', claudeApiLimiter, validateAndSanitizeInput, validateContentQuality, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Text is too short or empty'
      });
    }

    // Step 1: Extract facts (in English)
    const factPrompt = `Act as a neutral data extractor. Read the following Japanese text and extract its core factual statements into a simple, objective, bulleted list. Present the facts in English, translating any Japanese content accurately.

TEXT: ${text}`;

    const factResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: factPrompt
        }
      ]
    });

    const facts = factResponse.content[0].text;

    // Step 2: Translate with English Aichan persona
    let personaPromptContent;
    try {
      const personaPromptPath = path.join(__dirname, '../../prompts/prompt_aichan_english.txt');
      personaPromptContent = await fs.readFile(personaPromptPath, 'utf8');
    } catch (fileError) {
      return res.status(500).json({
        error: 'Persona prompt missing',
        message: 'ペルソナプロンプトファイルが見つかりません: prompt_aichan_english.txt'
      });
    }
    const combinedPrompt = personaPromptContent + '\n\n--- START OF FACTS TO EXPLAIN ---\n' + facts + '\n--- END OF FACTS TO EXPLAIN ---';

    const translationResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: combinedPrompt
        }
      ]
    });

    let translation = translationResponse.content[0].text;
    
    // レスポンス品質検証と改善（英語モード）
    const validation = responseValidator.validateResponse(translation, 'english');
    if (validation.confidence < 80) {
      console.warn('⚠️ 低品質レスポンス検出 (English):', validation.issues);
      translation = await responseValidator.improveResponse(translation, validation, 'english');
    }
    
    res.json({
      success: true,
      originalText: text,
      extractedFacts: facts,
      translation: translation,
      processingSteps: 2,
      ageMode: 'english',
      quality: {
        confidence: validation.confidence,
        issues: validation.issues
      }
    });

  } catch (error) {
    console.error('Full translation error (English):', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Claude API key is invalid'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'API rate limit reached. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'Translation failed',
      message: 'Translation process failed'
    });
  }
});

// API status endpoint
router.get('/status', (req, res) => {
  const hasApiKey = !!process.env.CLAUDE_API_KEY;
  
  res.json({
    status: 'OK',
    service: 'WakaLens Translation API',
    version: '1.0.0',
    endpoints: {
      '/api/extract-facts': 'POST - Extract facts from text',
      '/api/translate-persona': 'POST - Translate with Aichan persona',
      '/api/translate': 'POST - Full translation pipeline (1-3年生)',
      '/api/translate-4-6': 'POST - Full translation pipeline (4-6年生)',
      '/api/translate-english': 'POST - Full translation pipeline (English mode)'
    },
    apiKeyConfigured: hasApiKey,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;