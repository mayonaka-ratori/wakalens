# WakaLens デプロイメントガイド

## 🚀 本番環境セットアップ

### 必要な環境
- Node.js 18.0+ 
- NPM 8.0+
- Claude API キー（Anthropic）

### 1. プロジェクトクローン
```bash
git clone <repository-url>
cd wakalens-production
```

### 2. 依存関係インストール
```bash
cd backend
npm install
```

### 3. 環境変数設定
```bash
# backend/.env を作成
cp .env.example .env
```

`.env` ファイルを編集：
```env
# Claude AI API Configuration
CLAUDE_API_KEY=your_claude_api_key_here

# Server Configuration  
PORT=3001
NODE_ENV=production

# CORS Configuration
FRONTEND_URL=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX_REQUESTS=50

# Security
SESSION_SECRET=your_secure_random_string
```

### 4. 起動
```bash
# 開発環境
npm run dev

# 本番環境
npm start
```

### 5. アクセス
- Frontend: http://localhost:3001
- API Health Check: http://localhost:3001/api/status

## 🔧 本番環境の設定

### Nginx設定例
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2での起動（推奨）
```bash
npm install -g pm2
cd backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

`ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'wakalens-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
```

## 📊 監視・メトリクス

### ヘルスチェック
- GET `/health` - システム状態
- GET `/api/status` - API状態

### ログ監視
```bash
# PM2ログ
pm2 logs wakalens-api

# アプリケーションログ
tail -f logs/app.log
```

### メトリクス収集
- API応答時間
- エラー率
- レート制限ヒット数
- Claude API使用量

## 🔐 セキュリティ設定

### 本番環境チェックリスト
- [ ] HTTPS設定済み
- [ ] セキュリティヘッダー設定
- [ ] レート制限適切に設定
- [ ] APIキーの安全な管理
- [ ] 不要なログ出力の無効化
- [ ] エラーメッセージの適切な処理

## 🧪 動作確認テスト

### 基本機能テスト
```bash
# API接続テスト
curl http://localhost:3001/api/status

# 翻訳機能テスト
curl -X POST http://localhost:3001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"テストメッセージ"}'
```

### フロントエンド動作確認
1. ブラウザで http://localhost:3001 にアクセス
2. 年齢モード切り替えが動作することを確認
3. APIテストボタンでAPIが動作することを確認
4. サンプル画像ボタンが正常に動作することを確認

## 🚨 トラブルシューティング

### よくある問題
1. **Claude API 401エラー**: APIキーを確認
2. **CORS エラー**: FRONTEND_URLを確認  
3. **Tesseract読み込みエラー**: CDNアクセスを確認
4. **レート制限エラー**: 制限値を調整

### ログファイル場所
- アプリケーションログ: `logs/app.log`
- エラーログ: `logs/error.log` 
- PM2ログ: `~/.pm2/logs/`