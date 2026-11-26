import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const errors = [];

function requireValue(condition, message) {
  if (!condition) errors.push(message);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function attribute(attributes, name) {
  const expression = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = attributes.match(expression);
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

// Parse only the known script containers. No browser script is executed.
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .map((match, index) => ({ attributes: match[1], source: match[2], number: index + 1 }));

function jsonBlock(id) {
  const matches = scripts.filter((script) => attribute(script.attributes, 'id') === id);
  if (matches.length !== 1) throw new Error(`${id}: JSONブロックは1つ必要です（現在${matches.length}）`);
  if (attribute(matches[0].attributes, 'type') !== 'application/json') {
    throw new Error(`${id}: type="application/json" が必要です`);
  }
  try {
    return JSON.parse(matches[0].source);
  } catch (error) {
    throw new Error(`${id}: JSON構文エラー: ${error.message}`);
  }
}

try {
  const portfolio = jsonBlock('portfolio-data');
  const figures = jsonBlock('portfolio-figures');
  if (!object(portfolio) || !Array.isArray(portfolio.items)) {
    throw new Error('portfolio-data: items配列を持つオブジェクトが必要です');
  }
  if (!object(figures)) throw new Error('portfolio-figures: オブジェクトが必要です');

  requireValue(portfolio.language === 'ja', 'portfolio-data: languageはjaを指定してください');
  requireValue(nonempty(portfolio.schemaVersion), 'portfolio-data: schemaVersionが必要です');
  requireValue(nonempty(portfolio.dataStatus), 'portfolio-data: dataStatusが必要です');
  const ids = new Set();
  const slugs = new Set();

  for (const [index, item] of portfolio.items.entries()) {
    const label = object(item) && nonempty(item.id) ? item.id : `items[${index}]`;
    if (!object(item)) {
      errors.push(`${label}: 実績はオブジェクトで指定してください`);
      continue;
    }
    for (const key of ['id', 'slug', 'title', 'category', 'summary', 'stageCode', 'stageLabel']) {
      requireValue(nonempty(item[key]), `${label}: ${key}は空でない文字列が必要です`);
    }
    requireValue(typeof item.featured === 'boolean', `${label}: featuredは真偽値が必要です`);
    requireValue(item.purpose === null || typeof item.purpose === 'string', `${label}: purposeは文字列またはnullです`);
    if (nonempty(item.id)) {
      requireValue(!ids.has(item.id), `${label}: idが重複しています`);
      ids.add(item.id);
    }
    if (nonempty(item.slug)) {
      requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item.slug), `${label}: slugは英小文字・数字・ハイフンで指定してください`);
      requireValue(!slugs.has(item.slug), `${label}: slugが重複しています`);
      slugs.add(item.slug);
    }
    for (const key of ['activities', 'outcomes']) {
      requireValue(Array.isArray(item[key]), `${label}: ${key}は配列が必要です`);
      if (Array.isArray(item[key])) {
        requireValue(item[key].every(nonempty), `${label}: ${key}の各要素は空でない文字列です`);
      }
    }
    for (const [key, fields] of [['aiUsage', ['name', 'usage']], ['technologies', ['name', 'role', 'status']]]) {
      requireValue(Array.isArray(item[key]), `${label}: ${key}は配列が必要です`);
      if (Array.isArray(item[key])) {
        for (const entry of item[key]) {
          requireValue(object(entry) && fields.every((field) => nonempty(entry[field])), `${label}: ${key}には${fields.join('、')}が必要です`);
        }
      }
    }
    requireValue(Array.isArray(item.relatedLinks), `${label}: relatedLinksは配列が必要です`);
    if (Array.isArray(item.relatedLinks)) {
      for (const link of item.relatedLinks) {
        if (!object(link)) {
          errors.push(`${label}: 関連リンクはオブジェクトです`);
          continue;
        }
        requireValue(nonempty(link.label), `${label}: 関連リンクのlabelが必要です`);
        requireValue(typeof link.enabled === 'boolean', `${label}: 関連リンクのenabledは真偽値です`);
        try {
          const url = new URL(link.url);
          requireValue(url.protocol === 'https:', `${label}: 関連リンクはHTTPS URLを指定してください`);
          requireValue(!url.username && !url.password, `${label}: 関連リンクに認証情報を含めないでください`);
        } catch {
          errors.push(`${label}: 関連リンクのURL形式が不正です`);
        }
      }
    }
  }

  for (const [id, figure] of Object.entries(figures)) {
    requireValue(ids.has(id), `${id}: 説明図に対応する実績IDがありません`);
    if (!object(figure)) {
      errors.push(`${id}: 説明図はオブジェクトです`);
      continue;
    }
    requireValue(nonempty(figure.alt), `${id}: 説明図のaltが必要です`);
    requireValue(nonempty(figure.caption), `${id}: 説明図のcaptionが必要です`);
    requireValue(Number.isInteger(figure.width) && figure.width > 0, `${id}: 説明図のwidthは正の整数です`);
    requireValue(Number.isInteger(figure.height) && figure.height > 0, `${id}: 説明図のheightは正の整数です`);
    requireValue(typeof figure.src === 'string' && /^data:image\/(?:webp|png|jpeg|avif);base64,[A-Za-z0-9+/]+={0,2}$/u.test(figure.src), `${id}: 説明図の埋込み画像データ形式が不正です`);
  }

  let checkedScripts = 0;
  for (const script of scripts) {
    const type = (attribute(script.attributes, 'type') ?? '').toLowerCase();
    if (type === 'application/json' || attribute(script.attributes, 'src')) continue;
    if (!['', 'text/javascript', 'application/javascript'].includes(type)) {
      errors.push(`script ${script.number}: 未対応のスクリプト種別です（${type}）`);
      continue;
    }
    try {
      // vm.Script compiles without running; do not call runInContext/runInThisContext.
      new vm.Script(script.source, { filename: `index.html:inline-script-${script.number}` });
      checkedScripts += 1;
    } catch (error) {
      errors.push(`script ${script.number}: JavaScript構文エラー: ${error.message}`);
    }
  }
  requireValue(checkedScripts > 0, '構文確認対象のinline JavaScriptがありません');

  if (errors.length) {
    console.error(`検査NG（${errors.length}件）\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`検査OK: 実績${portfolio.items.length}件、説明図${Object.keys(figures).length}点、JavaScript${checkedScripts}ブロック`);
    console.log('JSONの読取り、必要項目、ID/slugの重複、図版との対応、JavaScript構文を確認しました。');
  }
} catch (error) {
  console.error(`検査NG: ${error.message}`);
  process.exitCode = 1;
}
