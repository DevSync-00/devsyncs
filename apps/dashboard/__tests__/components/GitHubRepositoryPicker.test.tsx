import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubRepositoryPicker from '@/components/github/GitHubRepositoryPicker';

describe('GitHubRepositoryPicker', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        repositories: [
          {
            id: 1,
            name: 'private-repo',
            fullName: 'devsync/private-repo',
            url: 'https://github.com/devsync/private-repo',
            private: true,
            owner: 'devsync',
          },
          {
            id: 2,
            name: 'public-repo',
            fullName: 'devsync/public-repo',
            url: 'https://github.com/devsync/public-repo',
            private: false,
            owner: 'devsync',
          },
        ],
      }),
    } as Response);
  });

  it('loads authorized repositories and returns the selected URL', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<GitHubRepositoryPicker value="" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Private - devsync/private-repo' }))
        .toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByRole('combobox'),
      'https://github.com/devsync/private-repo'
    );

    expect(onChange).toHaveBeenCalledWith('https://github.com/devsync/private-repo');
  });
});
