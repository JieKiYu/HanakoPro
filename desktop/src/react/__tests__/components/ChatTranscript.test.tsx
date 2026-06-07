// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatTranscript } from '../../components/chat/ChatTranscript';
import type { ChatListItem } from '../../stores/chat-types';

describe('ChatTranscript', () => {
  it('renders compaction markers as visible dividers', () => {
    const items: ChatListItem[] = [
      { type: 'compaction', id: 'c1', yuan: '上下文已自动压缩' },
    ];

    render(<ChatTranscript items={items} sessionPath="/s/test.jsonl" />);

    expect(screen.getByRole('separator', { name: '上下文已自动压缩' })).toBeInTheDocument();
    expect(screen.getByText('上下文已自动压缩')).toBeInTheDocument();
  });
});
