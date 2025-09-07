// Claude API セキュリティミドルウェア

const rateLimit = require('express-rate-limit');
const validator = require('validator');

// プロンプトインジェクション対策
const promptInjectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions?/i,
    /forget\s+(all\s+)?previous\s+(instructions?|context)/i,
    /system\s*:\s*/i,
    /assistant\s*:\s*/i,
    /human\s*:\s*/i,
    /###\s*(system|assistant|human)/i,
    /---\s*(system|assistant|human)/i,
    /\[system\]/i,
    /\[assistant\]/i,
    /\[human\]/i,
    /<\|system\|>/i,
    /<\|assistant\|>/i,
    /<\|human\|>/i,
    /jailbreak/i,
    /roleplay\s+as/i,
    /pretend\s+(to\s+be|you\s+are)/i,
];

// テキスト検証とサニタイゼーション
function validateAndSanitizeInput(req, res, next) {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
        return res.status(400).json({
            error: 'Invalid input',
            message: '有効なテキストを入力してください'
        });
    }
    
    // 長さ制限
    if (text.length > 10000) {
        return res.status(400).json({
            error: 'Text too long',
            message: 'テキストが長すぎます（10,000文字以内）'
        });
    }
    
    // 短すぎるテキストのチェック
    if (text.trim().length < 3) {
        return res.status(400).json({
            error: 'Text too short',
            message: 'テキストが短すぎます（3文字以上）'
        });
    }
    
    // プロンプトインジェクション検出
    const suspiciousPatterns = promptInjectionPatterns.filter(pattern => pattern.test(text));
    if (suspiciousPatterns.length > 0) {
        console.warn('🚨 プロンプトインジェクション試行を検出:', text.substring(0, 100));
        return res.status(400).json({
            error: 'Potentially harmful content detected',
            message: '不適切な内容が検出されました。通常のテキストを入力してください。'
        });
    }
    
    // HTMLタグの除去（XSS対策）
    req.body.text = validator.escape(text).replace(/<[^>]*>/g, '');
    
    next();
}

// Claude API専用レート制限
const claudeApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5分
    max: 10, // ユーザーあたり5分間に10リクエスト
    message: {
        error: 'Too many translation requests',
        message: 'リクエストが多すぎます。少し待ってから再試行してください。'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// コンテンツ品質チェック
function validateContentQuality(req, res, next) {
    const { text } = req.body;
    
    // 日本語文字の存在チェック
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    const hasOnlySymbols = /^[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(text.trim());
    
    if (hasOnlySymbols) {
        return res.status(400).json({
            error: 'Invalid content',
            message: '意味のあるテキストを入力してください'
        });
    }
    
    // 繰り返し文字の検出
    const repeatedChars = /(.)\1{10,}/.test(text);
    if (repeatedChars) {
        return res.status(400).json({
            error: 'Spam detected',
            message: '同じ文字の繰り返しは処理できません'
        });
    }
    
    next();
}

module.exports = {
    validateAndSanitizeInput,
    claudeApiLimiter,
    validateContentQuality
};