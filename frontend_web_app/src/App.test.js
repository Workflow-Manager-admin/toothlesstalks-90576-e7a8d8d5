import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Toothless AI Chat title', () => {
  render(<App />);
  expect(screen.getByText(/Toothless/i)).toBeInTheDocument();
});
