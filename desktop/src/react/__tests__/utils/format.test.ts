// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toSlash, baseName, parseCSV, isImageFile, formatSessionDate, parseMoodFromContent } from '../../utils/format';

describe('toSlash', () => {
  it('反斜杠转正斜杠', () => {
    expect(toSlash('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
  });

  it('已是正斜杠不变', () => {
    expect(toSlash('/usr/local/bin')).toBe('/usr/local/bin');
  });

  it('空字符串返回空', () => {
    expect(toSlash('')).toBe('');
  });
});

describe('baseName', () => {
  it('提取文件名（正斜杠）', () => {
    expect(baseName('/path/to/file.txt')).toBe('file.txt');
  });

  it('提取文件名（反斜杠）', () => {
    expect(baseName('C:\\path\\to\\file.txt')).toBe('file.txt');
  });

  it('无路径分隔符返回原文', () => {
    expect(baseName('file.txt')).toBe('file.txt');
  });
});

describe('parseCSV', () => {
  it('解析简单 CSV', () => {
    const result = parseCSV('a,b,c\n1,2,3');
    expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('处理带引号的字段', () => {
    const result = parseCSV('"hello, world",b\n1,2');
    expect(result[0][0]).toBe('hello, world');
  });

  it('处理引号内的转义引号', () => {
    const result = parseCSV('"say ""hi""",b');
    expect(result[0][0]).toBe('say "hi"');
  });

  it('空输入返回空数组', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('跳过空行', () => {
    const result = parseCSV('a,b\n\nc,d');
    expect(result).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('isImageFile', () => {
  it('常见图片格式返回 true', () => {
    expect(isImageFile('photo.png')).toBe(true);
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('photo.jpeg')).toBe(true);
    expect(isImageFile('photo.gif')).toBe(true);
    expect(isImageFile('photo.webp')).toBe(true);
    expect(isImageFile('photo.svg')).toBe(true);
  });

  it('非图片格式返回 false', () => {
    expect(isImageFile('doc.pdf')).toBe(false);
    expect(isImageFile('code.ts')).toBe(false);
    expect(isImageFile('data.json')).toBe(false);
  });

  it('大小写不敏感', () => {
    expect(isImageFile('PHOTO.PNG')).toBe(true);
    expect(isImageFile('Photo.Jpg')).toBe(true);
  });
});

describe('formatSessionDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00.000Z'));
    window.t = ((key: string, vars?: Record<string, string | number>) => {
      if (key === 'time.justNow') return '刚刚';
      if (key === 'time.minutesAgo') return `${vars?.n} 分钟前`;
      if (key === 'time.hoursAgo') return `${vars?.n} 小时前`;
      if (key === 'time.daysAgo') return `${vars?.n} 天前`;
      if (key === 'time.weeksAgo') return `${vars?.n} 周前`;
      if (key === 'time.monthsAgo') return `${vars?.n} 个月前`;
      return key;
    }) as typeof window.t;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows week labels for one to three weeks', () => {
    expect(formatSessionDate('2026-05-31T12:00:00.000Z')).toBe('1 周前');
    expect(formatSessionDate('2026-05-24T12:00:00.000Z')).toBe('2 周前');
    expect(formatSessionDate('2026-05-17T12:00:00.000Z')).toBe('3 周前');
  });

  it('switches to month labels from the fourth week onward', () => {
    expect(formatSessionDate('2026-05-10T12:00:00.000Z')).toBe('1 个月前');
    expect(formatSessionDate('2026-04-12T12:00:00.000Z')).toBe('2 个月前');
  });
});

describe('parseMoodFromContent (format.ts)', () => {
  it('解析 mood 标签', () => {
    const result = parseMoodFromContent('<mood>content</mood>\nText.');
    expect(result.mood).toBe('content');
    expect(result.text).toBe('Text.');
  });

  it('无 mood 标签', () => {
    const result = parseMoodFromContent('plain text');
    expect(result.mood).toBeNull();
    expect(result.text).toBe('plain text');
  });
});
