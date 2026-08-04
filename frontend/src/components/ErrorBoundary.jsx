// components/ErrorBoundary.jsx - Updated with better debugging
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo: errorInfo });
    
    // Log to your monitoring service if you have one
    // You can also send this to your backend for debugging
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
            <div className="text-center">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h2>
              <p className="text-gray-600 mb-4">The application encountered an error. Please try refreshing the page.</p>
              
              {/* Show error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg text-left overflow-auto max-h-60">
                  <p className="font-mono text-sm text-red-600 mb-2">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;