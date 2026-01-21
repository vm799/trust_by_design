import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmailFirstAuth from '../../../views/EmailFirstAuth';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

// Mock Supabase
const mockSupabase = {
    auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
            }))
        }))
    })),
    rpc: vi.fn().mockResolvedValue({ data: false, error: null })
};

vi.mock('../../../lib/supabase', () => ({
    getSupabase: () => mockSupabase,
}));

describe('EmailFirstAuth View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the email input initially', () => {
        render(
            <BrowserRouter>
                <EmailFirstAuth />
            </BrowserRouter>
        );

        expect(screen.getByText(/Access Your Workspace/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('contractor@company.com')).toBeInTheDocument();
        // Query the email submit button specifically (not "Continue with Google")
        expect(screen.getByRole('button', { name: /^Continue$/ })).toBeInTheDocument();
    });

    it('updates email state on input change', () => {
        render(
            <BrowserRouter>
                <EmailFirstAuth />
            </BrowserRouter>
        );

        const input = screen.getByPlaceholderText('contractor@company.com') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'test@example.com' } });
        expect(input.value).toBe('test@example.com');
    });
});
