import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

type BoundaryState = { error: Error | null }

class FridayErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('FRIDAY UI runtime error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#03050a',
          color: '#f7f9ff',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}>
          <section style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 12, letterSpacing: '0.2em', opacity: 0.55 }}>FRIDAY UI</div>
            <h1 style={{ fontSize: 32, margin: '12px 0 8px' }}>FRIDAY hit a browser error.</h1>
            <p style={{ opacity: 0.7, lineHeight: 1.6 }}>
              The page is still running in the browser. Reload once; if the error persists,
              the technical detail below identifies the failing runtime path.
            </p>
            <pre style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 14,
              background: '#ffffff08',
              border: '1px solid #ffffff12',
              overflow: 'auto',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              color: '#ffb5c4',
            }}>{this.state.error.message}</pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: '11px 16px',
                border: 0,
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              Reload FRIDAY
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FridayErrorBoundary>
      <App />
    </FridayErrorBoundary>
  </React.StrictMode>,
)
