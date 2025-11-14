import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import Navbar from '@/components/layout/Navbar'

describe('Navbar Component', () => {
  it('renders the navigation bar', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('displays brand name', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByText(/blog/i)).toBeInTheDocument()
  })

  it('shows login button when not authenticated', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByText(/login/i)).toBeInTheDocument()
  })
})