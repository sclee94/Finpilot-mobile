/**
 * 마크다운 본문 앞부분 → 목록 미리보기용 일반 텍스트.
 * 표/구분선 줄은 버리고, 제목·인용·목록 기호와 굵게/코드/링크 문법을 걷어낸 뒤 공백을 한 칸으로 합친다.
 */
export function markdownToPlainPreview(md: string | null | undefined): string {
  if (!md) return '';
  return md
    .split('\n')
    .filter(line => !/^\s*\|/.test(line) && !/^\s*([-*_])\1{2,}\s*$/.test(line))
    .map(line => line
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*([-*+]|\d+\.)\s+/, ''))
    .join(' ')
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
