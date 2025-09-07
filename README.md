# 🔍 WakaLens (わかるレンズ) - Production Version

世界初の「認知翻訳」アプリ - 難しい文章を8歳児でもわかる言葉に翻訳します。

## ✨ 主な機能

- 📸 **カメラOCR**: スマートフォンのカメラで文書を読み取り
- 🖼️ **画像URL読み込み**: オンライン画像からテキストを抽出
- 🤖 **2段階AI翻訳**: 事実抽出 → あいちゃんペルソナによる認知翻訳
- 🔄 **リアルタイム処理**: 高速でレスポンシブなユーザー体験

## 🏗️ アーキテクチャ

```
wakalens-production/
├── frontend/           # React/HTML フロントエンド
│   ├── index.html
│   ├── script.js       # メインアプリケーションロジック
│   └── style.css       # スタイリング
├── backend/            # Node.js Express API
│   ├── server.js       # メインサーバー
│   ├── routes/
│   │   └── api.js      # API エンドポイント
│   ├── package.json
│   └── .env.example    # 環境変数テンプレート
├── prompts/            # AIペルソナプロンプト
│   └── prompt_aichan_8yo.txt
└── README.md
```

## 🚀 セットアップ & 実行

### 1. 依存関係のインストール

```bash
cd wakalens-production/backend
npm install
```

### 2. 環境変数の設定

```bash
# .env.example をコピーして .env を作成
cp .env.example .env

# .env ファイルを編集し、Claude API キーを設定
CLAUDE_API_KEY=your_claude_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:3001
```

### 3. サーバー起動

```bash
# 開発モード（自動リロード）
npm run dev

# 本番モード
npm start
```

### 4. アプリケーションアクセス

ブラウザで `http://localhost:3001` を開いてください。

## 📋 API エンドポイント

### 🔍 全翻訳パイプライン
```
POST /api/translate
Content-Type: application/json

{
  "text": "抽出されたテキスト"
}
```

**レスポンス:**
```json
{
  "success": true,
  "originalText": "元のテキスト",
  "extractedFacts": "抽出された事実",
  "translation": "あいちゃんによる翻訳",
  "processingSteps": 2
}
```

### 📊 個別エンドポイント
- `POST /api/extract-facts` - 事実抽出のみ
- `POST /api/translate-persona` - ペルソナ翻訳のみ
- `GET /api/status` - API状態確認
- `GET /health` - ヘルスチェック

## 🛡️ セキュリティ機能

- **Helmet.js**: セキュリティヘッダー設定
- **CORS**: クロスオリジン要求制御
- **Rate Limiting**: API レート制限
- **Input Validation**: 入力値検証
- **Error Handling**: 包括的エラーハンドリング

## 🔧 開発

### ログ確認
```bash
# サーバーログをリアルタイムで確認
npm run dev
```

### テスト
```bash
# API接続テスト
curl http://localhost:3001/api/status

# 翻訳テスト
curl -X POST http://localhost:3001/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"本サービス内で購入されたゲーム内通貨は、購入から180日を期限とし、期限を過ぎたものは失効します。"}'
```

## 🌐 デプロイ

### Railway.app (推奨)
1. GitHubにプッシュ
2. Railway.appでプロジェクト作成
3. 環境変数設定
4. 自動デプロイ

### Vercel/Netlify
- バックエンドはServerless Functionsとして実装可能
- フロントエンドは静的サイトとしてホスティング

## 🎯 使用例

1. **利用規約の翻訳**
   - 複雑な法的文書を子供向けに翻訳

2. **学習支援**
   - 難しい教材を理解しやすい言葉で説明

3. **アクセシビリティ向上**
   - 複雑な情報を誰でも理解できる形に変換

## 🤖 あいちゃんペルソナ

8歳の探偵「あいちゃん」が、難しい「暗号」を解き明かして、やさしい言葉で教えてくれます：

- 🔍 好奇心旺盛な探偵ごっこ
- 🎯 たとえ話の天才
- 💭 共感的な対話スタイル
- ✨ ポジティブな学習体験

## 📜 ライセンス

MIT License

## 🙏 謝辞

- **Anthropic Claude**: 高品質なAI翻訳エンジン
- **Tesseract.js**: ブラウザベースOCR
- **Express.js**: 高速なWebアプリケーションフレームワーク

---

**WakaLens Team** - 世界初の認知翻訳技術で、理解の架け橋を構築します 🌉