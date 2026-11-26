# 開発・確認手順

## 現在のサイト構成

このサイトは `index.html` にCSS、JavaScript、実績データ、説明図を含めた静的ページである。デザイン・本文・画面の仕様は既存の [README](../README.md) を参照する。

今回追加した開発環境は、現在の単一HTML構成を保ったまま更新内容を検査するためのもの。別JSONファイルからの再生成や静的サイト生成ツールへの移行は行わない。

## 必要な環境

- Node.js 24。対象バージョンは `.node-version` と `package.json` に記載。
- npm。外部npm依存はない。
- Git。専用リポジトリは `nekobus775-eng/nekobus775-eng.github.io`、既定ブランチは `main`。

## 検査の実行

リポジトリの作業フォルダで次を実行する。

```bash
npm ci --ignore-scripts
npm run check
```

`npm run check` は `scripts/validate-site.mjs` を実行し、次を確認する。

- `portfolio-data` と `portfolio-figures` が、それぞれ1つの `application/json` ブロックとして存在し、JSONとして読み取れること。
- 実績の必要項目と配列、ID・slugの重複、関連URLの形式。
- 説明図の管理IDが実績と対応し、代替テキスト・キャプション・寸法・画像データ形式を備えること。
- inline JavaScriptの構文。スクリプトを実行せず、構文解析だけを行う。

検査はデータ構造とJavaScript構文を対象とする。ブラウザでの検索・詳細表示・スマートフォン表示、画像の内容、公開可否、外部リンク先の到達性は別途確認する。リンクの既存の採用判断は変更しない。

## ファイル配置

| パス | 役割 |
| --- | --- |
| `index.html` | 既存のデザイン、本文、実績JSON、図版JSON、画面処理 |
| `README.md` | 既存サイトの機能・更新方法・公開用構成の説明 |
| `scripts/validate-site.mjs` | 現在の単一HTMLを対象とする軽量検査 |
| `.github/workflows/validate.yml` | push・Pull Request・手動実行時の自動チェック |
| `package.json`、`package-lock.json` | Node.jsと検査コマンドの定義 |
| `.gitignore` | 内部資料・草稿・認証情報・一時ファイルの追跡除外 |

実績追加・修正では `index.html` 内のJSONを更新し、デザイン変更では同ファイル内のCSS・HTML・JavaScriptを更新する。説明図の大きなbase64データをログやレビュー本文へそのまま出力しない。

## 自動チェックと公開

`main`へのpush、Pull Request、Actionsからの手動実行で `npm ci --ignore-scripts` と `npm run check` を実行する。ワークフローは `contents: read` のみを使い、Pagesへの配信は行わない。

GitHub Pagesを公開する工程では、既存READMEの構成に合わせて `main` ブランチの `/ (root)` を公開元に設定し、一般公開URLで表示・操作を確認する。今回追加した検査ワークフローを有効にしただけでは、Pagesの公開設定は変わらない。

元のExcel・PowerPoint、内部照合記録、未公開の草稿、認証情報は、このPublicリポジトリの外で管理する。
