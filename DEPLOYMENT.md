# 🚀 WakaLens デプロイメントガイド

本格的なWakaLensアプリケーションを本番環境にデプロイする方法。

## 🔧 ローカル開発環境

### 1. 初期セットアップ
```bash
cd wakalens-production/backend
npm install
cp .env.example .env
```

### 2. Claude API キー設定
```bash
# .env ファイルを編集
CLAUDE_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
```

### 3. 開発サーバー起動
```bash
npm run dev
```

アクセス: http://localhost:3001

## ☁️ クラウドデプロイ

### Railway.app (最推奨)

**特徴**: Node.js完全対応、環境変数管理、自動デプロイ

1. **GitHubリポジトリ準備**
```bash
git init
git add .
git commit -m "Initial WakaLens production version"
git remote add origin https://github.com/yourusername/wakalens-production.git
git push -u origin main
```

2. **Railway.appでプロジェクト作成**
   - https://railway.app でアカウント作成
   - "New Project" → "Deploy from GitHub repo"
   - wakalens-production リポジトリを選択

3. **環境変数設定**
```
CLAUDE_API_KEY=your_actual_api_key
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-app-name.railway.app
```

4. **デプロイ設定**
   - Root Directory: `/backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

### Render.com

**特徴**: 無料枠あり、簡単設定

1. **Render.comアカウント作成**
2. **Web Service作成**
   - Repository: GitHub連携
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
3. **環境変数設定** (上記と同じ)

### Heroku

**特徴**: 歴史が長い、プラグイン豊富

1. **Heroku CLI インストール**
2. **プロジェクト作成**
```bash
cd wakalens-production/backend
heroku create wakalens-app
heroku config:set CLAUDE_API_KEY=your_api_key
heroku config:set NODE_ENV=production
git subtree push --prefix=backend heroku main
```

## 🌐 フロントエンドのみデプロイ (静的ホスティング)

フロントエンドを別途デプロイし、バックエンドAPIと分離する方法。

### Vercel (推奨)

1. **フロントエンド修正**
```javascript
// frontend/script.js の apiBaseUrl を変更
this.apiBaseUrl = 'https://your-backend-api.railway.app/api';
```

2. **Vercel デプロイ**
```bash
cd wakalens-production/frontend
npx vercel --prod
```

### Netlify

1. **Build 設定**
```bash
# netlify.toml
[build]
  publish = "frontend"
  
[[redirects]]
  from = "/api/*"
  to = "https://your-backend-api.railway.app/api/:splat"
  status = 200
```

## 🔒 セキュリティ設定

### 本番環境での必須設定

1. **環境変数**
```bash
NODE_ENV=production
SESSION_SECRET=random_long_string_here
RATE_LIMIT_MAX_REQUESTS=50
RATE_LIMIT_WINDOW_MS=900000
```

2. **CORS設定**
```javascript
// 本番フロントエンドURLを正確に設定
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

3. **HTTPS強制**
```javascript
// server.js に追加
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

## 📊 監視とログ

### ログ管理
```bash
# Railway/Render でのログ確認
railway logs

# Heroku でのログ確認  
heroku logs --tail
```

### ヘルスチェック
- `GET /health` エンドポイントで定期監視
- `GET /api/status` でAPI状態確認

## 🎯 パフォーマンス最適化

### 1. 画像最適化
```javascript
// OCR処理前に画像リサイズ
const maxWidth = 1280;
const maxHeight = 720;
```

### 2. キャッシュ設定
```javascript
// 静的ファイルのキャッシュ
app.use(express.static('../frontend', {
  maxAge: '1d'
}));
```

### 3. gzip圧縮
```bash
npm install compression
```
```javascript
const compression = require('compression');
app.use(compression());
```

## 🔄 継続的デプロイ

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Deploy to Railway
      uses: railway/deploy@v1
      with:
        railway_token: ${{ secrets.RAILWAY_TOKEN }}
```

## ❓ トラブルシューティング

### よくある問題

1. **Claude API 401エラー**
   - APIキーが正しく設定されているか確認
   - APIキーの有効期限確認

2. **CORS エラー**
   - FRONTEND_URL が正確に設定されているか確認
   - 本番URLとローカルURLの違いに注意

3. **OCR 失敗**
   - 画像サイズが大きすぎる場合がある
   - ネットワークタイムアウトの確認

### デバッグコマンド
```bash
# 環境変数確認
echo $CLAUDE_API_KEY

# API疎通確認
curl https://your-app.railway.app/api/status

# 翻訳テスト
curl -X POST https://your-app.railway.app/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"テストメッセージ"}'
```

## 📈 スケーリング

### 水平スケーリング
- Railway: 自動スケーリング対応
- 負荷分散設定

### 垂直スケーリング
- メモリ/CPU設定調整
- データベース導入検討

---

**🌟 本番環境でのWakaLens運用が成功することを願っています！**