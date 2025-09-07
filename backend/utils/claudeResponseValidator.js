// Claude API レスポンス検証とフォールバック処理

const fs = require('fs').promises;
const path = require('path');

class ClaudeResponseValidator {
    constructor() {
        this.minResponseLength = 50;
        this.maxResponseLength = 5000;
        this.requiredElements = ['あいちゃん', 'わたし'];
    }

    // レスポンス品質チェック
    validateResponse(response, ageMode = '1-3') {
        const validation = {
            isValid: true,
            issues: [],
            confidence: 100
        };

        // 基本的な長さチェック
        if (!response || response.length < this.minResponseLength) {
            validation.isValid = false;
            validation.issues.push(ageMode === 'english' ? 'Response too short' : 'レスポンスが短すぎます');
            validation.confidence -= 30;
        }

        if (response.length > this.maxResponseLength) {
            validation.issues.push(ageMode === 'english' ? 'Response too long' : 'レスポンスが長すぎます');
            validation.confidence -= 10;
        }

        // ペルソナ要素チェック
        let hasPersonaElements;
        if (ageMode === 'english') {
            hasPersonaElements = response.includes('Ai-chan') || response.includes('detective');
            if (!hasPersonaElements) {
                validation.issues.push('English Ai-chan persona insufficient');
                validation.confidence -= 40;
            }
        } else {
            hasPersonaElements = this.requiredElements.some(element => 
                response.includes(element)
            );
            if (!hasPersonaElements) {
                validation.issues.push('あいちゃんペルソナが不十分');
                validation.confidence -= 40;
            }
        }

        // 年齢別適切性チェック
        if (ageMode === '1-3') {
            const hasComplexKanji = this.hasComplexKanji(response);
            if (hasComplexKanji.length > 0) {
                validation.issues.push(`1-3年生に難しい漢字: ${hasComplexKanji.slice(0, 3).join(', ')}`);
                validation.confidence -= 20;
            }
        }

        // 構造化レスポンスチェック（4-6年生）
        if (ageMode === '4-6') {
            const hasStructure = response.includes('#') || response.includes('**') || response.includes('。');
            if (!hasStructure) {
                validation.issues.push('4-6年生用の構造化が不十分');
                validation.confidence -= 15;
            }
        }

        // 英語モード構造化チェック
        if (ageMode === 'english') {
            const hasStructure = response.includes('**') || response.includes('Mystery') || response.includes('!');
            if (!hasStructure) {
                validation.issues.push('English mode structure insufficient');
                validation.confidence -= 15;
            }
        }

        return validation;
    }

    // 複雑な漢字の検出（1-3年生用）
    hasComplexKanji(text) {
        const simpleKanji = '一二三四五六七八九十百千万円年月日時間分人大小中長出入上下左右前後内外東西南北山川田中村松田川島田中山田木村林森石金水火土空雨雪花草木犬猫鳥魚虫子男女父母兄弟姉妹友達先生学校家店車電話本読書勉強仕事遊食事朝昼夜今明日昨日';
        
        const complexKanji = [];
        for (let char of text) {
            if (this.isKanji(char) && !simpleKanji.includes(char)) {
                if (!complexKanji.includes(char)) {
                    complexKanji.push(char);
                }
            }
        }
        
        return complexKanji;
    }

    isKanji(char) {
        const code = char.charCodeAt(0);
        return (code >= 0x4E00 && code <= 0x9FAF);
    }

    // フォールバック応答生成
    async generateFallback(originalText, ageMode = '1-3') {
        const fallbackResponses = {
            '1-3': `こんにちは！あいちゃんだよ！

むずかしいおはなしを見つけたね！でも、ちょっと よくわからなくて、もう一度 きいてもいいかな？

「${originalText.substring(0, 50)}...」

について、もっと かんたんに きいてくれると、あいちゃんも もっと よく わかるよ！

もっと知りたいことはある？`,

            '4-6': `こんにちは！あいちゃんです🔍

今回の内容を調査してみたんですが、少し複雑で、もう少し詳しい情報が必要みたいです。

**調査対象:**
${originalText.substring(0, 100)}...

**あいちゃんからのお願い:**
この内容について、もう少し具体的に教えてもらえると、もっと詳しく調査できるよ！

もっと詳しく知りたいことはある？`
        };

        return fallbackResponses[ageMode] || fallbackResponses['1-3'];
    }

    // レスポンス改善提案
    async improveResponse(response, validationResult, ageMode) {
        if (validationResult.confidence > 80) {
            return response; // 十分な品質
        }

        let improvedResponse = response;

        // 1-3年生モード: 難しい漢字を平仮名に変換
        if (ageMode === '1-3') {
            const complexKanji = this.hasComplexKanji(response);
            for (let kanji of complexKanji.slice(0, 5)) { // 最初の5個まで処理
                const hiraganaMap = {
                    '調査': 'しらべること',
                    '確認': 'たしかめること', 
                    '説明': 'せつめい',
                    '理解': 'りかい',
                    '重要': 'たいせつ',
                    '問題': 'もんだい',
                    '解決': 'かいけつ',
                    '状況': 'じょうきょう',
                    '方法': 'ほうほう',
                    '結果': 'けっか'
                };

                if (hiraganaMap[kanji]) {
                    improvedResponse = improvedResponse.replace(
                        new RegExp(kanji, 'g'), 
                        hiraganaMap[kanji]
                    );
                }
            }
        }

        return improvedResponse;
    }
}

module.exports = ClaudeResponseValidator;