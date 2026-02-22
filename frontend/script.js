// WakaLens - わかるレンズ メインスクリプト (Production Version - 最終版)

class WakaLens {
    constructor() {
        this.stream = null;
        this.currentImageSource = 'camera';
        this.apiBaseUrl = window.location.origin + '/api';
        this.currentAgeMode = '1-3'; // デフォルトは1-3年生モード
        console.log('🚀 WakaLens Production 初期化開始');
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.cameraElement = document.getElementById('camera');
        this.captureCanvas = document.getElementById('capture-canvas');
        this.loadedImage = document.getElementById('loaded-image');
        this.startCameraBtn = document.getElementById('start-camera');
        this.loadImageBtn = document.getElementById('load-image');
        this.translateBtn = document.getElementById('translate-btn');
        this.testApiBtn = document.getElementById('test-api-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.loadingDiv = document.getElementById('loading');
        this.resultSection = document.getElementById('result-section');
        this.resultText = document.getElementById('result-text');
        this.resultHeader = document.getElementById('result-header');
        this.tryAgainBtn = document.getElementById('try-again');
        this.imageInputSection = document.getElementById('image-input-section');
        this.imageUrlInput = document.getElementById('image-url');
        this.loadUrlImageBtn = document.getElementById('load-url-image');
        this.sampleJpBtn = document.getElementById('sample-jp');
        this.sampleEnBtn = document.getElementById('sample-en');
        this.mode13Btn = document.getElementById('mode-1-3');
        this.mode46Btn = document.getElementById('mode-4-6');
        this.modeEnglishBtn = document.getElementById('mode-english');
    }

    bindEvents() {
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.loadImageBtn.addEventListener('click', () => this.showImageInput());
        this.loadUrlImageBtn.addEventListener('click', () => this.loadImageFromUrl());
        this.translateBtn.addEventListener('click', () => this.performTranslation());
        this.testApiBtn.addEventListener('click', () => this.testAPI());
        this.tryAgainBtn.addEventListener('click', () => this.reset());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.sampleJpBtn.addEventListener('click', () => this.loadSampleImage('jp'));
        this.sampleEnBtn.addEventListener('click', () => this.loadSampleImage('en'));
        this.mode13Btn.addEventListener('click', () => this.switchAgeMode('1-3'));
        this.mode46Btn.addEventListener('click', () => this.switchAgeMode('4-6'));
        this.modeEnglishBtn.addEventListener('click', () => this.switchAgeMode('english'));
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment'
                } 
            });
            this.cameraElement.srcObject = this.stream;
            this.startCameraBtn.textContent = 'カメラ起動中...';
            this.startCameraBtn.disabled = true;
            
            this.cameraElement.onloadedmetadata = () => {
                this.hideAllInputs();
                this.cameraElement.style.display = 'block';
                this.currentImageSource = 'camera';
                this.translateBtn.style.display = 'inline-flex';
                this.resetBtn.style.display = 'inline-flex';
                console.log('📸 カメラ準備完了');
            };
        } catch (error) {
            console.error('カメラアクセスエラー:', error);
            this.showError('カメラにアクセスできませんでした。');
            this.startCameraBtn.innerHTML = '<span class="icon">📸</span>カメラを開始';
            this.startCameraBtn.disabled = false;
        }
    }

    captureImage() {
        const canvas = this.captureCanvas;
        const ctx = canvas.getContext('2d');
        
        if (this.currentImageSource === 'camera') {
            canvas.width = this.cameraElement.videoWidth;
            canvas.height = this.cameraElement.videoHeight;
            ctx.drawImage(this.cameraElement, 0, 0);
        } else {
            canvas.width = this.loadedImage.naturalWidth;
            canvas.height = this.loadedImage.naturalHeight;
            ctx.drawImage(this.loadedImage, 0, 0);
        }
        
        return canvas.toDataURL('image/png');
    }

    // 日本語OCR最適化：画像前処理を強化
    async preprocessImageForJapaneseOCR(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 日本語OCR用最適サイズ：幅2000px（高解像度）
                const targetWidth = 2000;
                const targetHeight = (img.height * targetWidth) / img.width;
                
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                
                // 高品質リサンプリング
                ctx.imageSmoothingEnabled = false; // 文字の鮮明性を保持
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                
                // 日本語文字に最適化した画像処理
                const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // より精密なグレースケール変換（日本語文字用）
                    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                    
                    // 日本語文字の特徴を考慮した二値化
                    // 細い線の文字も識別しやすくする
                    let binary;
                    if (gray > 180) {
                        binary = 255; // 背景
                    } else if (gray < 100) {
                        binary = 0;   // 確実な文字
                    } else {
                        // 中間値は周辺ピクセルを考慮して決定
                        binary = gray > 140 ? 255 : 0;
                    }
                    
                    data[i] = binary;
                    data[i + 1] = binary;
                    data[i + 2] = binary;
                }
                
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = imageData;
        });
    }

    async performOCR(imageData) {
        try {
            console.log('🔍 日本語OCR処理開始...');
            
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract.jsライブラリが読み込まれていません');
            }
            
            // 日本語特化の画像前処理
            console.log('📸 日本語OCR用画像前処理中...');
            const preprocessedImage = await this.preprocessImageForJapaneseOCR(imageData);
            
            console.log('🤖 日本語文字認識実行中...');
            
            // 日本語に最適化されたOCR設定（警告を避けるため有効なパラメータのみ使用）
            const result = await Tesseract.recognize(preprocessedImage, 'jpn', {
                logger: function(m) {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR進行: ${Math.round(m.progress * 100)}%`);
                    }
                },
                // 日本語専用の最適化設定（確実に有効なパラメータのみ）
                tessedit_pageseg_mode: 6, // PSM.UNIFORM_BLOCK（日本語の文書ブロック用）
                tessedit_ocr_engine_mode: 1, // LSTM専用（最高精度）
                preserve_interword_spaces: '1',
                // 日本語の文字認識精度向上設定
                textord_min_linesize: '2.5',
                classify_enable_adaptive_matcher: '1',
                // シンプルで確実な設定のみ
                textord_heavy_nr: '1'
            });
            
            const text = result.data.text;
            const confidence = result.data.confidence;
            
            const extractedText = text.trim();
            console.log(`📝 OCR結果 (信頼度: ${Math.round(confidence)}%):`, extractedText);
            
            if (!extractedText || extractedText.length < 1) {
                throw new Error('文字が検出されませんでした');
            }
            
            if (confidence < 20) {
                console.warn(`⚠️ OCR信頼度が低い: ${confidence}%`);
                // 信頼度が低くても結果が得られた場合は処理を続行
            }
            
            return extractedText;
            
        } catch (error) {
            console.error('❌ OCRエラー:', error);
            throw new Error(`日本語文字の読み取りに失敗: ${error.message}`);
        }
    }

    async callAPI(endpoint, data) {
        try {
            console.log('🔌 Claude API呼び出し:', endpoint);
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `API呼び出しエラー: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ API応答受信完了');
            return result;
        } catch (error) {
            console.error('❌ API呼び出しエラー:', error);
            
            if (error.message.includes('Failed to fetch')) {
                throw new Error('サーバーに接続できませんでした');
            }
            
            throw error;
        }
    }

    async performTranslation() {
        this.showLoading(true);
        this.translateBtn.disabled = true;

        try {
            const imageData = this.captureImage();
            
            this.updateLoadingMessage('文字を読み取っています...');
            const extractedText = await this.performOCR(imageData);
            
            const loadingMsg = this.currentAgeMode === 'english' ? 'Ai is researching now...' : 'あいちゃんがしらべています！';
            this.updateLoadingMessage(loadingMsg);
            console.log('📤 Claude APIに送信:', extractedText.substring(0, 50) + '...');
            
            let endpoint;
            if (this.currentAgeMode === 'english') {
                endpoint = '/translate-english';
            } else if (this.currentAgeMode === '4-6') {
                endpoint = '/translate-4-6';
            } else {
                endpoint = '/translate';
            }
            const result = await this.callAPI(endpoint, { text: extractedText });
            
            console.log('🎯 翻訳完了');
            this.lastExtractedText = extractedText; // 再翻訳用に保存
            this.showResult(result.translation);
            
        } catch (error) {
            console.error('❌ 翻訳エラー:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
            this.translateBtn.disabled = false;
        }
    }

    async testAPI() {
        console.log('🧪 APIテスト開始');
        this.showLoading(true);
        this.testApiBtn.disabled = true;
        
        try {
            const testText = "本サービス内で購入されたゲーム内通貨は、購入から180日を期限とし、期限を過ぎたものは失効します。";
            
            const loadingMsg = this.currentAgeMode === 'english' ? 'API test in progress...' : 'APIテスト実行中...';
            this.updateLoadingMessage(loadingMsg);
            
            let endpoint;
            if (this.currentAgeMode === 'english') {
                endpoint = '/translate-english';
            } else if (this.currentAgeMode === '4-6') {
                endpoint = '/translate-4-6';
            } else {
                endpoint = '/translate';
            }
            const result = await this.callAPI(endpoint, { text: testText });
            
            const successMsg = this.currentAgeMode === 'english' ? '🧪 **API Test Success!**\n\n' : '🧪 **APIテスト成功！**\n\n';
            this.showResult(successMsg + result.translation);
            
        } catch (error) {
            console.error('❌ APIテストエラー:', error);
            this.showError(`APIテスト失敗: ${error.message}`);
        } finally {
            this.showLoading(false);
            this.testApiBtn.disabled = false;
        }
    }

    showImageInput() {
        this.hideAllInputs();
        this.imageInputSection.style.display = 'block';
    }

    async loadImageFromUrl() {
        const url = this.imageUrlInput.value.trim();
        if (!url) {
            this.showError('画像のURLを入力してください');
            return;
        }

        try {
            new URL(url);
        } catch {
            this.showError('有効なURLを入力してください');
            return;
        }

        this.loadUrlImageBtn.disabled = true;
        this.loadUrlImageBtn.textContent = '読み込み中...';

        try {
            await new Promise((resolve, reject) => {
                this.loadedImage.crossOrigin = 'anonymous';
                this.loadedImage.onload = resolve;
                this.loadedImage.onerror = () => reject(new Error('画像読み込み失敗'));
                setTimeout(() => reject(new Error('タイムアウト')), 10000);
                this.loadedImage.src = url;
            });

            this.hideAllInputs();
            this.loadedImage.style.display = 'block';
            this.currentImageSource = 'url';
            this.translateBtn.style.display = 'inline-flex';
            this.resetBtn.style.display = 'inline-flex';
            console.log('🖼️ 画像読み込み完了');
            
        } catch (error) {
            console.error('❌ 画像読み込みエラー:', error);
            this.showError(error.message);
        } finally {
            this.loadUrlImageBtn.disabled = false;
            this.loadUrlImageBtn.textContent = 'この画像を読み込む';
        }
    }

    hideAllInputs() {
        this.startCameraBtn.style.display = 'none';
        this.loadImageBtn.style.display = 'none';
        this.imageInputSection.style.display = 'none';
        this.cameraElement.style.display = 'none';
        this.loadedImage.style.display = 'none';
    }

    showLoading(show) {
        this.loadingDiv.style.display = show ? 'block' : 'none';
        if (!show) {
            this.updateLoadingMessage('あいちゃんが調べています...');
        }
    }

    updateLoadingMessage(message) {
        const loadingText = this.loadingDiv.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    showResult(text) {
        // HTMLマークダウンをサポートするためにinnerHTMLを使用
        this.resultText.innerHTML = this.parseMarkdownToHTML(text);
        
        // モードに合わせてヘッダーを変更
        if (this.currentAgeMode === 'english') {
            this.resultHeader.textContent = 'Ai-chan\'s Detective Report';
        } else if (this.currentAgeMode === '4-6') {
            this.resultHeader.textContent = 'あいちゃんの調査レポート';
        } else {
            this.resultHeader.textContent = 'あいちゃんからのレポート';
        }
        
        this.resultSection.style.display = 'block';
        this.resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        const main = document.querySelector('main');
        main.insertBefore(errorDiv, main.firstChild);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 8000);
    }

    reset() {
        this.resultSection.style.display = 'none';
        this.translateBtn.style.display = 'none';
        this.currentImageSource = 'camera';
        
        this.startCameraBtn.style.display = 'inline-flex';
        this.startCameraBtn.innerHTML = '<span class="icon">📸</span>カメラを開始';
        this.startCameraBtn.disabled = false;
        this.loadImageBtn.style.display = 'inline-flex';
        this.resetBtn.style.display = 'none';
        this.imageInputSection.style.display = 'none';
        this.cameraElement.style.display = 'block';
        this.loadedImage.style.display = 'none';
        this.imageUrlInput.value = '';
        
        this.stopCamera();
        
        const errorMessage = document.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}

// Tesseract.js読み込み確認とアプリ初期化
document.addEventListener('DOMContentLoaded', () => {
    const checkTesseractLoaded = () => {
        return new Promise((resolve, reject) => {
            if (typeof Tesseract !== 'undefined') {
                console.log('✅ Tesseract.js 読み込み完了');
                resolve();
                return;
            }
            
            let attempts = 0;
            const checkInterval = setInterval(() => {
                attempts++;
                if (typeof Tesseract !== 'undefined') {
                    console.log('✅ Tesseract.js 読み込み完了 (遅延)');
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= 100) { // 10秒待機
                    clearInterval(checkInterval);
                    reject(new Error('Tesseract.js読み込みタイムアウト'));
                }
            }, 100);
        });
    };
    
    checkTesseractLoaded()
        .then(() => {
            console.log('🎉 WakaLens Production 起動完了');
            const app = new WakaLens();
            
            // API接続確認
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    console.log('🚀 API接続成功:', data.service);
                })
                .catch(error => {
                    console.error('❌ API接続確認失敗:', error);
                });
            
            window.addEventListener('beforeunload', () => {
                app.stopCamera();
            });
            
            window.wakaLensApp = app;
        })
        .catch(error => {
            console.error('❌ 初期化失敗:', error);
            
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #ff6b6b; color: white; padding: 15px 30px; border-radius: 10px; z-index: 1000; font-weight: bold;';
            errorDiv.textContent = 'アプリケーションの初期化に失敗しました。ページを再読み込みしてください。';
            document.body.appendChild(errorDiv);
        });
});

// 新規メソッド追加：年齢モード切り替え、サンプル画像読み込み、マークダウンパース
WakaLens.prototype.switchAgeMode = function(mode) {
    this.currentAgeMode = mode;
    
    // ボタンのactive状態を更新
    this.mode13Btn.classList.toggle('active', mode === '1-3');
    this.mode46Btn.classList.toggle('active', mode === '4-6');
    this.modeEnglishBtn.classList.toggle('active', mode === 'english');
    
    // 結果が表示されている場合は再翻訳ボタンを表示
    if (this.resultSection.style.display === 'block' && this.lastExtractedText) {
        this.showRetranslateButton();
    }
    
    console.log(`🔄 年齢モード切り替え: ${mode}`);
};

WakaLens.prototype.loadSampleImage = function(type) {
    const urls = {
        jp: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800',
        en: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800'
    };
    
    if (urls[type]) {
        this.imageUrlInput.value = urls[type];
        this.loadImageFromUrl();
    }
};

WakaLens.prototype.parseMarkdownToHTML = function(text) {
    return text
        // **太字** -> <strong>太字</strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // <u>下線</u> -> <u>下線</u>
        .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
        // ### 見出し3 -> <h3>見出し3</h3>
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        // ## 見出し2 -> <h2>見出し2</h2>
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        // # 見出し1 -> <h1>見出し1</h1>
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // 🕵️‍♀️ のような絵文字をspan.emojiでラップ
        .replace(/([\u{1F300}-\u{1F9FF}]|\u{2600}-\u{26FF}|\u{2700}-\u{27BF})/gu, '<span class="emoji">$1</span>')
        // 改行を<br>に変換（ただし連続する改行は段落分けのため<p>タグで処理）
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        // 最初と最後にpタグを追加
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
        // 空のpタグを削除
        .replace(/<p><\/p>/g, '');
};

// 年齢モード切り替え時の再翻訳機能
WakaLens.prototype.showRetranslateButton = function() {
    // 既存の再翻訳ボタンを削除
    const existingBtn = document.getElementById('retranslate-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // 現在とは異なるモードを表示（複数のモードから選択）
    let targetMode, buttonText;
    
    if (this.currentAgeMode === '1-3') {
        targetMode = '4-6';
        buttonText = '4-6年生モードでわかる！';
    } else if (this.currentAgeMode === '4-6') {
        targetMode = 'english';
        buttonText = 'English Mode!';
    } else { // english
        targetMode = '1-3';
        buttonText = '1-3年生モードでわかる！';
    }
    
    // 新しい再翻訳ボタンを作成
    const retranslateBtn = document.createElement('button');
    retranslateBtn.id = 'retranslate-btn';
    retranslateBtn.className = 'btn btn-secondary';
    retranslateBtn.innerHTML = buttonText;
    
    // ボタンクリック時の処理（対象モードで翻訳）
    retranslateBtn.addEventListener('click', () => this.retranslateWithTargetMode(targetMode));
    
    // 結果セクションのボタンコンテナを作成/取得
    const tryAgainBtn = document.getElementById('try-again');
    let buttonContainer = document.getElementById('result-buttons');
    
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.id = 'result-buttons';
        buttonContainer.className = 'result-buttons';
        tryAgainBtn.parentNode.insertBefore(buttonContainer, tryAgainBtn);
        buttonContainer.appendChild(tryAgainBtn);
    }
    
    // 再翻訳ボタンを追加
    buttonContainer.appendChild(retranslateBtn);
};

WakaLens.prototype.retranslateWithTargetMode = async function(targetMode) {
    if (!this.lastExtractedText) {
        this.showError('再翻訳するテキストが見つかりません');
        return;
    }
    
    // モードを切り替え
    this.currentAgeMode = targetMode;
    this.mode13Btn.classList.toggle('active', targetMode === '1-3');
    this.mode46Btn.classList.toggle('active', targetMode === '4-6');
    this.modeEnglishBtn.classList.toggle('active', targetMode === 'english');
    
    this.showLoading(true);
    
    try {
        let loadingMsg, endpoint;
        
        if (targetMode === 'english') {
            loadingMsg = 'Ai is researching now...';
            endpoint = '/translate-english';
        } else if (targetMode === '4-6') {
            loadingMsg = '4-6年生向けになおしているよ！';
            endpoint = '/translate-4-6';
        } else {
            loadingMsg = 'もっとわかりやすくしてるよ！';
            endpoint = '/translate';
        }
        
        this.updateLoadingMessage(loadingMsg);
        const result = await this.callAPI(endpoint, { text: this.lastExtractedText });
        
        const modeLabel = targetMode === 'english' ? 'English' : `${targetMode}年生`;
        console.log(`🎯 再翻訳完了 (${modeLabel}モード)`);
        this.showResult(result.translation);
        
        // 再翻訳ボタンを再表示
        this.showRetranslateButton();
        
    } catch (error) {
        console.error('❌ 再翻訳エラー:', error);
        this.showError(error.message);
    } finally {
        this.showLoading(false);
    }
};