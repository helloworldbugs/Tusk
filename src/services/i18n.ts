/**
 * Lightweight i18n — detects browser language, provides $t(key) function.
 * English is the fallback (keys are the English strings themselves).
 * Chinese translations in zh-CN.ts override matched keys.
 */
import zhCN from '@/locales/zh-CN';

const isZh = typeof navigator !== 'undefined' && navigator.language.startsWith('zh');

export function useI18n() {
  function t(key: string, ...args: any[]): string {
    if (isZh && zhCN[key] !== undefined) {
      let val = zhCN[key];
      // Replace {0}, {1}, ... with args
      for (let i = 0; i < args.length; i++) {
        val = val.replace('{' + i + '}', String(args[i]));
      }
      return val;
    }
    // Fallback: return key as-is (English)
    let val = key;
    for (let i = 0; i < args.length; i++) {
      val = val.replace('{' + i + '}', String(args[i]));
    }
    return val;
  }

  return { t, isZh };
}

export const i18n = useI18n();
