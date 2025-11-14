import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// extends Vitest's expect with jest-dom matchers
expect.extend(matchers)

// runs a cleanup after each test case
afterEach(() => {
  cleanup()
})

// Mock environment variables
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  }
})

// Mock API calls
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock auth context
vi.mock('@/context/AuthContext', () => ({
  AuthContext: {
    Provider: ({ children }) => children,
  },
  useAuth: () => ({
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
  }),
}))