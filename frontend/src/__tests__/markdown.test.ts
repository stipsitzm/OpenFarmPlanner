/**
 * Tests for markdown utility functions
 */

import { describe, it, expect } from 'vitest';
import { stripMarkdown, getPlainExcerpt } from '../components/data-grid/markdown';

describe('stripMarkdown', () => {
  it('should return empty string for null input', () => {
    // @ts-expect-error intentionally testing null handling
    expect(stripMarkdown(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(stripMarkdown(undefined as any)).toBe('');
  });

  it('should return empty string for empty input', () => {
    expect(stripMarkdown('')).toBe('');
  });

  it('should remove code blocks with triple backticks', () => {
    const input = 'Hello ```const x = 1;``` World';
    expect(stripMarkdown(input)).toBe('Hello  World');
  });

  it('should remove inline code with single backticks', () => {
    const input = 'The `code` is here';
    expect(stripMarkdown(input)).toBe('The code is here');
  });

  it('should remove headers', () => {
    const input = '# Header 1\n## Header 2\n### Header 3\nText';
    const result = stripMarkdown(input);
    // Headers (# ## ###) are removed but content after them remains
    expect(result).not.toContain('#');
    expect(result).toContain('Header 1');
    expect(result).toContain('Header 2');
    expect(result).toContain('Header 3');
    expect(result).toContain('Text');
  });

  it('should remove bold formatting with double asterisks', () => {
    const input = 'This is **bold** text';
    expect(stripMarkdown(input)).toBe('This is bold text');
  });

  it('should remove bold formatting with double underscores', () => {
    const input = 'This is __bold__ text';
    expect(stripMarkdown(input)).toBe('This is bold text');
  });

  it('should remove italic formatting with single asterisks', () => {
    const input = 'This is *italic* text';
    expect(stripMarkdown(input)).toBe('This is italic text');
  });

  it('should remove italic formatting with single underscores', () => {
    const input = 'This is _italic_ text';
    expect(stripMarkdown(input)).toBe('This is italic text');
  });

  it('should remove links and keep text', () => {
    const input = 'Check [this link](https://example.com) here';
    expect(stripMarkdown(input)).toBe('Check this link here');
  });

  it('should remove images completely', () => {
    const input = 'Image: ![alt text](https://example.com/image.jpg) gone';
    const result = stripMarkdown(input);
    expect(result).not.toContain('](');
    expect(result).toContain('Image');
    expect(result).toContain('gone');
  });

  it('should remove horizontal rules', () => {
    const input = 'Text above\n---\nText below';
    expect(stripMarkdown(input)).toBe('Text above\nText below');
  });

  it('should remove unordered list markers', () => {
    const input = '- Item 1\n- Item 2\n+ Item 3\n* Item 4';
    expect(stripMarkdown(input)).toBe('Item 1\nItem 2\nItem 3\nItem 4');
  });

  it('should remove ordered list markers', () => {
    const input = '1. First\n2. Second\n10. Tenth';
    expect(stripMarkdown(input)).toBe('First\nSecond\nTenth');
  });

  it('should remove blockquotes', () => {
    const input = '> This is quoted\n> More quote';
    expect(stripMarkdown(input)).toBe('This is quoted\nMore quote');
  });

  it('should normalize multiple newlines', () => {
    const input = 'Line 1\n\n\nLine 2\n\n\nLine 3';
    expect(stripMarkdown(input)).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should trim whitespace', () => {
    const input = '  Text with spaces  ';
    expect(stripMarkdown(input)).toBe('Text with spaces');
  });

  it('should handle mixed markdown syntax', () => {
    const input = '# Title\n**Bold** and *italic* with [link](url).\n> Quote\n- List item';
    const result = stripMarkdown(input);
    expect(result).not.toContain('#');
    expect(result).not.toContain('**');
    expect(result).not.toContain('[');
    expect(result).toContain('Bold');
    expect(result).toContain('italic');
    expect(result).toContain('link');
    expect(result).toContain('Quote');
    expect(result).toContain('List item');
  });

  it('should handle malformed markdown gracefully', () => {
    const input = '**unclosed bold [unclosed link](url';
    const result = stripMarkdown(input);
    expect(result).toBeTruthy();
    // Malformed markdown may not be fully cleaned, but should be returned
    expect(typeof result).toBe('string');
  });

  it('should preserve normal content without markdown', () => {
    const input = 'This is plain text without any markdown syntax.';
    expect(stripMarkdown(input)).toBe('This is plain text without any markdown syntax.');
  });
});

describe('getPlainExcerpt', () => {
  it('should return empty string for null input', () => {
    // @ts-expect-error intentionally testing null handling
    expect(getPlainExcerpt(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(getPlainExcerpt(undefined as any)).toBe('');
  });

  it('should return empty string for empty input', () => {
    expect(getPlainExcerpt('')).toBe('');
  });

  it('should return empty string for whitespace-only input', () => {
    expect(getPlainExcerpt('   \n  \t  ')).toBe('');
  });

  it('should return full text when under maxLength', () => {
    const input = 'Short text';
    expect(getPlainExcerpt(input)).toBe('Short text');
  });

  it('should return full text when exactly at maxLength', () => {
    const input = 'a'.repeat(120);
    expect(getPlainExcerpt(input, 120)).toBe(input);
  });

  it('should truncate and add ellipsis when exceeds default maxLength', () => {
    const input = 'a'.repeat(150);
    const result = getPlainExcerpt(input);
    expect(result).toHaveLength(123); // 120 chars + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('should truncate and add ellipsis when exceeds custom maxLength', () => {
    const input = 'a'.repeat(100);
    const result = getPlainExcerpt(input, 50);
    expect(result).toBe('a'.repeat(50) + '...');
  });

  it('should strip markdown before truncating', () => {
    const input = '**Bold text** ' + 'a'.repeat(150);
    const result = getPlainExcerpt(input, 120);
    expect(result.startsWith('Bold text')).toBe(true);
    expect(result.endsWith('...')).toBe(true);
    expect(result).not.toContain('**');
  });

  it('should use maxLength parameter correctly', () => {
    const input = 'This is a test string for excerpt truncation';
    const result = getPlainExcerpt(input, 10);
    expect(result).toBe('This is a...');
  });

  it('should respect custom maxLength of 1', () => {
    const input = 'Hello';
    const result = getPlainExcerpt(input, 1);
    expect(result).toBe('H...');
  });

  it('should handle zero maxLength', () => {
    const input = 'Hello World';
    const result = getPlainExcerpt(input, 0);
    expect(result).toBe('...');
  });

  it('should trim result when adding ellipsis', () => {
    const veryLongText = 'x'.repeat(200);
    const result = getPlainExcerpt(veryLongText, 50);
    expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('should handle markdown with truncation', () => {
    const input = '[Link](url) and **bold**. ' + 'Description: ' + 'x'.repeat(120);
    const result = getPlainExcerpt(input, 50);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
  });
});
